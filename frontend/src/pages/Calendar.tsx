import { useEffect, useMemo, useRef, useState, FormEvent, MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { focusSessionService, SessionTimeConflictError } from '../api/services';
import type { FocusSession } from '../types';
import { formatDuration } from '../utils/formatters';
import {
  MINUTES_PER_DAY,
  MIN_BLOCK_MINUTES,
  addDays,
  buildWeek,
  categoryColors,
  formatDayHeader,
  formatHourLabel,
  formatMinutes,
  formatWeekRange,
  isDateKey,
  mondayOf,
  parseUtc,
  todayKey,
  tzAbbreviation,
  weekDays,
  weekQueryRange,
  zonedParts,
  zonedToUtc,
  type CalendarBlock,
} from '../utils/calendar';
import './Calendar.css';
import './Goals.css'; // modal styles

const PAGE_SIZE = 500;
const HOUR_HEIGHT = 60; // px, keep in sync with --hour-height in Calendar.css
// The grid opens showing this hour at the top; Calendar.css sizes the window
// to 11 hours, so 8 AM to 7 PM is in view
const FIRST_VISIBLE_HOUR = 8;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CLICK_SNAP_MINUTES = 15;
// Blocks drawn shorter than this only have room for one line of text
const COMPACT_BLOCK_MINUTES = 40;

// The session dialog's fields: a new session from a click on the grid, or an
// existing one being edited
interface Draft {
  dateKey: string;
  tz: string; // the zone dateKey and startTime are read in
  startTime: string; // "HH:MM"
  hours: string;
  minutes: string;
  category: string;
  customCategory: string;
  showCustom: boolean;
  // Set when editing: the block being replaced and the values the dialog
  // opened with, to tell which fields the user actually changed
  editing?: { block: CalendarBlock; startTime: string; hours: string; minutes: string };
}

// The week currently drawn. It stays on screen while another week loads.
interface LoadedWeek {
  weekStart: string;
  sessions: FocusSession[];
}

function toTimeInput(minutes: number): string {
  const total = Math.floor(minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function Calendar() {
  const { user } = useAuth();
  const { categories, reloadCategories } = usePomodoro();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loaded, setLoaded] = useState<LoadedWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CalendarBlock | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [reloadCount, setReloadCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const userTz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayKey(userTz);

  const weekParam = searchParams.get('week');
  // weekStart is the week asked for; shownWeek is the one on screen, which
  // lags behind until the new week's sessions arrive
  const weekStart = mondayOf(isDateKey(weekParam) ? weekParam : today);
  const shownWeek = loaded?.weekStart ?? weekStart;
  const days = weekDays(shownWeek);

  const goToWeek = (dateKey: string) => {
    setSearchParams({ week: mondayOf(dateKey) });
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const range = weekQueryRange(weekStart);
        const all: FocusSession[] = [];
        for (let skip = 0; ; skip += PAGE_SIZE) {
          const page = await focusSessionService.getSessions(user.email, {
            ...range,
            skip,
            limit: PAGE_SIZE,
          });
          all.push(...page);
          if (page.length < PAGE_SIZE) break;
        }
        if (!cancelled) {
          setLoaded({ weekStart, sessions: all });
          setSelected(null);
          setError('');
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
        if (!cancelled) {
          setLoaded({ weekStart, sessions: [] });
          setSelected(null);
          setError('Failed to load focus sessions. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, weekStart, reloadCount]);

  // Keep the "now" line moving
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Escape closes the new-session dialog
  useEffect(() => {
    if (!draft) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !draftSaving) setDraft(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft, draftSaving]);

  const week = useMemo(() => buildWeek(loaded?.sessions ?? [], shownWeek), [loaded, shownWeek]);
  const blocks = useMemo(() => Object.values(week).flat(), [week]);

  const colors = useMemo(
    () => categoryColors([...categories.map((c) => c.category), ...blocks.map((b) => b.session.category)]),
    [categories, blocks]
  );

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const block of blocks) {
      const category = block.session.category;
      totals.set(category, (totals.get(category) ?? 0) + block.session.focus_time_seconds);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [blocks]);

  const weekTotal = categoryTotals.reduce((sum, [, seconds]) => sum + seconds, 0);

  // Open the grid on the working day. Only once: after that the scroll
  // position is the user's, and carries over when they switch weeks.
  useEffect(() => {
    if (!loaded || !scrollRef.current || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    scrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT;
  }, [loaded]);

  const nowMinutes = zonedParts(now, userTz).minutes;

  const describeBlock = (block: CalendarBlock) => {
    const { session } = block;
    const foreignTz = session.tz !== userTz ? ` ${tzAbbreviation(parseUtc(session.time), session.tz)}` : '';
    return {
      range: `${formatMinutes(block.startMin)} – ${formatMinutes(block.endMin)}${foreignTz}`,
      duration: formatDuration(session.focus_time_seconds),
    };
  };

  const handleDelete = async () => {
    if (!user || !selected) return;
    const { session } = selected;
    if (!confirm(`Delete ${describeBlock(selected).duration} of ${session.category}?`)) return;

    setDeleting(true);
    setError('');
    try {
      await focusSessionService.deleteSession(user.email, session.time);
      setReloadCount((count) => count + 1);
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError('Failed to delete session. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDayClick = (day: string, e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clicked = ((e.clientY - rect.top) / rect.height) * MINUTES_PER_DAY;
    const snapped = Math.min(
      Math.max(Math.floor(clicked / CLICK_SNAP_MINUTES) * CLICK_SNAP_MINUTES, 0),
      MINUTES_PER_DAY - CLICK_SNAP_MINUTES
    );

    setDraftError('');
    setDraft({
      dateKey: day,
      tz: userTz, // new sessions are logged in the user's current tz
      startTime: toTimeInput(snapped),
      hours: '',
      minutes: '30',
      category: categories.length > 0 ? categories[0].category : '',
      customCategory: '',
      showCustom: categories.length === 0,
    });
  };

  const handleEdit = () => {
    if (!selected) return;
    const { session } = selected;
    const known = categories.some((cat) => cat.category === session.category);
    const startTime = toTimeInput(selected.startMin);
    const hours = String(Math.floor(session.focus_time_seconds / 3600));
    const minutes = String(Math.floor((session.focus_time_seconds % 3600) / 60));

    setDraftError('');
    setDraft({
      dateKey: selected.dateKey,
      tz: session.tz,
      startTime,
      hours,
      minutes,
      category: known ? session.category : '',
      customCategory: known ? '' : session.category,
      showCustom: !known,
      editing: { block: selected, startTime, hours, minutes },
    });
  };

  // There is no update endpoint, so an edit is a create plus a delete.
  const replaceSession = async (email: string, old: FocusSession, category: string, seconds: number, end: Date) => {
    const oldEnd = parseUtc(old.time);

    if (end.getTime() !== oldEnd.getTime()) {
      // Different end time: add the new one first so a failure loses nothing
      await focusSessionService.createSessionEndingAt(email, { category, focus_time_seconds: seconds }, end);
      await focusSessionService.deleteSession(email, old.time);
      return;
    }

    // Same end time: the two can't coexist, so the old one has to go first
    await focusSessionService.deleteSession(email, old.time);
    try {
      await focusSessionService.createSessionWithTime(email, {
        category,
        focus_time_seconds: seconds,
        time: end.toISOString(),
      });
    } catch (err) {
      // Put the original back rather than leave the time unlogged
      await focusSessionService.createSessionWithTime(email, {
        category: old.category,
        focus_time_seconds: old.focus_time_seconds,
        time: oldEnd.toISOString(),
      });
      throw err;
    }
  };

  const handleDraftSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !draft) return;
    setDraftError('');

    const { editing } = draft;
    const old = editing?.block.session;
    // Untouched fields keep the session's exact values: the dialog only shows
    // whole minutes, and timer sessions are precise to the second
    const lengthChanged = !editing || draft.hours !== editing.hours || draft.minutes !== editing.minutes;
    const startChanged = !editing || draft.startTime !== editing.startTime;

    const hours = parseInt(draft.hours) || 0;
    const minutes = parseInt(draft.minutes) || 0;
    if (hours < 0 || minutes < 0) {
      setDraftError('Please enter positive values');
      return;
    }
    const seconds = old && !lengthChanged ? old.focus_time_seconds : hours * 3600 + minutes * 60;
    if (seconds === 0) {
      setDraftError('Please enter a time greater than 0');
      return;
    }

    const category = (draft.showCustom ? draft.customCategory : draft.category).trim();
    if (!category) {
      setDraftError('Please select or enter a category');
      return;
    }

    const [startHour, startMinute] = draft.startTime.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMinute)) {
      setDraftError('Please enter a start time');
      return;
    }

    const start =
      old && !startChanged
        ? new Date(parseUtc(old.time).getTime() - old.focus_time_seconds * 1000)
        : zonedToUtc(draft.dateKey, startHour * 60 + startMinute, draft.tz);
    const end = new Date(start.getTime() + seconds * 1000);

    if (old && !lengthChanged && !startChanged && category === old.category) {
      setDraft(null);
      return;
    }

    if (end.getTime() > Date.now()) {
      setDraftError('This session would end in the future');
      return;
    }

    setDraftSaving(true);
    try {
      if (old) {
        await replaceSession(user.email, old, category, seconds, end);
      } else {
        await focusSessionService.createSessionEndingAt(
          user.email,
          { category, focus_time_seconds: seconds },
          end
        );
      }
      setDraft(null);
      // Reload categories in case a new custom category was created
      await reloadCategories();
    } catch (err) {
      if (err instanceof SessionTimeConflictError) {
        setDraftError('A session already ends at exactly that time. Please adjust the start or length.');
      } else {
        setDraftError(
          old
            ? 'Failed to save the change. Check the calendar: the session may be missing or duplicated.'
            : 'Failed to log time. Please try again.'
        );
        console.error(err);
      }
    } finally {
      setDraftSaving(false);
      // Always refetch: a failed edit may still have changed something
      setReloadCount((count) => count + 1);
    }
  };

  return (
    <div className={`calendar-page ${loading && loaded ? 'is-loading' : ''}`}>
      <h1>Calendar</h1>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button className="btn calendar-nav-btn" onClick={() => goToWeek(addDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <button className="btn calendar-nav-btn" onClick={() => setSearchParams({})}>
            Today
          </button>
          <button className="btn calendar-nav-btn" onClick={() => goToWeek(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
          <h2 className="calendar-range">{formatWeekRange(shownWeek)}</h2>
        </div>

        <div className="calendar-jump">
          <label htmlFor="calendar-date">Go to week of</label>
          <input
            id="calendar-date"
            type="date"
            className="input"
            value={weekStart}
            onChange={(e) => {
              if (isDateKey(e.target.value)) goToWeek(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="calendar-summary">
        <span className="calendar-total">
          {loaded ? `${formatDuration(weekTotal)} focused this week` : 'Loading…'}
        </span>
        <div className="calendar-legend">
          {categoryTotals.map(([category, seconds]) => (
            <span key={category} className="calendar-legend-item">
              <span className="calendar-legend-swatch" style={{ background: colors.get(category) }} />
              {category} · {formatDuration(seconds)}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="calendar-detail" aria-live="polite">
        {selected ? (
          <>
            <span className="calendar-legend-swatch" style={{ background: colors.get(selected.session.category) }} />
            <strong>{selected.session.category}</strong>
            <span>
              {formatDayHeader(selected.dateKey).weekday} {formatDayHeader(selected.dateKey).day}
            </span>
            <span>{describeBlock(selected).range}</span>
            <span>{describeBlock(selected).duration}</span>
            <button className="btn calendar-nav-btn calendar-detail-btn" onClick={handleEdit} disabled={deleting}>
              Edit
            </button>
            <button className="btn btn-danger calendar-detail-btn" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        ) : loaded && !error && blocks.length === 0 ? (
          <span>No focus sessions logged this week. Click the calendar to add one.</span>
        ) : (
          <span>Select a session to edit or delete it, or click an empty spot to add one.</span>
        )}
      </div>

      <div className="calendar-card card">
        <div className="calendar-scroll-x">
          <div className="calendar-grid">
            <div className="calendar-header">
              <div className="calendar-gutter" />
              {days.map((day) => {
                const header = formatDayHeader(day);
                const dayTotal = week[day].reduce((sum, b) => sum + b.session.focus_time_seconds, 0);
                return (
                  <div key={day} className={`calendar-day-header ${day === today ? 'today' : ''}`}>
                    <span className="calendar-weekday">{header.weekday}</span>
                    <span className="calendar-date">{header.day}</span>
                    <span className="calendar-day-total">{dayTotal > 0 ? formatDuration(dayTotal) : '—'}</span>
                  </div>
                );
              })}
            </div>

            <div className="calendar-body" ref={scrollRef}>
              <div className="calendar-body-inner">
                <div className="calendar-gutter">
                  {HOURS.map((hour) => (
                    <div key={hour} className="calendar-hour-label">
                      {hour === 0 ? '' : formatHourLabel(hour)}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <div
                    key={day}
                    className={`calendar-day ${day === today ? 'today' : ''}`}
                    onClick={(e) => handleDayClick(day, e)}
                  >
                    {week[day].map((block) => {
                      const { range, duration } = describeBlock(block);
                      const visualMinutes = Math.max(block.endMin - block.startMin, MIN_BLOCK_MINUTES);
                      const isSelected = selected?.session.time === block.session.time;
                      return (
                        <button
                          key={block.session.time}
                          className={`calendar-block ${isSelected ? 'selected' : ''} ${
                            visualMinutes < COMPACT_BLOCK_MINUTES ? 'compact' : ''
                          }`}
                          style={{
                            top: `${(block.startMin / MINUTES_PER_DAY) * 100}%`,
                            height: `${(visualMinutes / MINUTES_PER_DAY) * 100}%`,
                            left: `${(block.col / block.cols) * 100}%`,
                            width: `${100 / block.cols}%`,
                            background: colors.get(block.session.category),
                          }}
                          title={`${block.session.category}\n${range}\n${duration}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(isSelected ? null : block);
                          }}
                        >
                          <span className="calendar-block-title">{block.session.category}</span>
                          <span className="calendar-block-time">{range}</span>
                        </button>
                      );
                    })}

                    {day === today && (
                      <div className="calendar-now" style={{ top: `${(nowMinutes / MINUTES_PER_DAY) * 100}%` }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {draft && (
        <div className="modal-overlay" onClick={() => !draftSaving && setDraft(null)}>
          <div className="modal-content calendar-draft" onClick={(e) => e.stopPropagation()}>
            <h3>
              {draft.editing ? 'Edit session on' : 'Log time on'} {formatDayHeader(draft.dateKey).weekday} {formatDayHeader(draft.dateKey).day}
            </h3>

            <form onSubmit={handleDraftSubmit}>
              <div className="form-group">
                <label htmlFor="draftCategory">Category</label>
                <select
                  id="draftCategory"
                  className="input"
                  value={draft.showCustom ? 'Custom' : draft.category}
                  onChange={(e) =>
                    setDraft(
                      e.target.value === 'Custom'
                        ? { ...draft, showCustom: true }
                        : { ...draft, showCustom: false, category: e.target.value }
                    )
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.category} value={cat.category}>
                      {cat.category}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {draft.showCustom && (
                <div className="form-group">
                  <label htmlFor="draftCustomCategory">Custom Category Name</label>
                  <input
                    id="draftCustomCategory"
                    type="text"
                    className="input"
                    value={draft.customCategory}
                    onChange={(e) => setDraft({ ...draft, customCategory: e.target.value })}
                    placeholder="Enter category name"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="draftStart">Started At</label>
                <input
                  id="draftStart"
                  type="time"
                  step={60}
                  className="input"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="draftHours">Time Worked</label>
                <div className="calendar-draft-duration">
                  <input
                    id="draftHours"
                    type="number"
                    min="0"
                    className="input"
                    value={draft.hours}
                    onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
                    placeholder="Hours"
                    autoFocus
                  />
                  <input
                    id="draftMinutes"
                    type="number"
                    min="0"
                    max="59"
                    className="input"
                    value={draft.minutes}
                    onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                    placeholder="Minutes (0-59)"
                    aria-label="Minutes"
                  />
                </div>
              </div>

              {draftError && <div className="error">{draftError}</div>}

              <div className="calendar-draft-actions">
                <button type="button" className="btn calendar-nav-btn" onClick={() => setDraft(null)} disabled={draftSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={draftSaving}>
                  {draftSaving ? 'Saving…' : draft.editing ? 'Save Changes' : 'Log Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
