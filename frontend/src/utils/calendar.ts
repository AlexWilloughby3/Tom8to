import type { FocusSession } from '../types';

export const MINUTES_PER_DAY = 1440;

// Blocks shorter than this are drawn (and packed) as if they were this long,
// so a 2-minute session is still visible and clickable.
export const MIN_BLOCK_MINUTES = 20;

export interface CalendarBlock {
  session: FocusSession;
  dateKey: string; // "YYYY-MM-DD" in the session's own tz
  startMin: number; // wall-clock minutes from local midnight
  endMin: number;
  col: number; // column within its overlap cluster
  cols: number; // total columns in that cluster
}

// ----- Date keys ("YYYY-MM-DD", no timezone attached) -----

function keyToUtc(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = keyToUtc(value);
  return !isNaN(date.getTime()) && utcToKey(date) === value;
}

export function addDays(key: string, days: number): string {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

// Weeks start on Monday, matching the backend's get_local_week_start
export function mondayOf(key: string): string {
  const dayOfWeek = keyToUtc(key).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dayOfWeek + 6) % 7));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatDayHeader(key: string): { weekday: string; day: string } {
  const date = keyToUtc(key);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  };
}

export function formatWeekRange(weekStart: string): string {
  const start = keyToUtc(weekStart);
  const end = keyToUtc(addDays(weekStart, 6));
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${startLabel} – ${endLabel}`;
}

// ----- Timezone conversion -----

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = formatters.get(tz);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    try {
      formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: tz });
    } catch {
      // Unknown tz name: fall back to the browser's zone
      formatter = new Intl.DateTimeFormat('en-US', options);
    }
    formatters.set(tz, formatter);
  }
  return formatter;
}

export function zonedParts(date: Date, tz: string): { dateKey: string; minutes: number } {
  const parts: Record<string, string> = {};
  for (const part of getFormatter(tz).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) + Number(parts.second) / 60,
  };
}

// Inverse of zonedParts: the instant at which tz's wall clock reads the given
// date and minutes-from-midnight.
export function zonedToUtc(dateKey: string, minutes: number, tz: string): Date {
  const wallClock = keyToUtc(dateKey).getTime() + minutes * 60000;
  let guess = wallClock;
  // Two passes so the offset is taken at the result, not at the first guess
  // (they differ on days the clocks change)
  for (let i = 0; i < 2; i++) {
    const parts = zonedParts(new Date(guess), tz);
    const shown = keyToUtc(parts.dateKey).getTime() + parts.minutes * 60000;
    guess += wallClock - shown;
  }
  return new Date(guess);
}

export function todayKey(tz: string): string {
  return zonedParts(new Date(), tz).dateKey;
}

export function tzAbbreviation(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date);
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

// The API returns naive UTC timestamps (no "Z"); without one, JS would parse
// them as browser-local time.
export function parseUtc(time: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(time) ? time : `${time}Z`);
}

// The session filters compare against a naive UTC column, so send naive UTC.
export function toNaiveUtc(date: Date): string {
  return date.toISOString().slice(0, -1);
}

// ----- Sessions -> calendar blocks -----

// A session stores only its end time; the start is end minus duration.
export function sessionToBlock(session: FocusSession): CalendarBlock {
  const end = parseUtc(session.time);
  const start = new Date(end.getTime() - session.focus_time_seconds * 1000);
  const startParts = zonedParts(start, session.tz);
  const endParts = zonedParts(end, session.tz);

  // Sessions are split at local midnight on save, so one ending on a later
  // date than it started ends exactly at midnight.
  const endMin = endParts.dateKey === startParts.dateKey ? endParts.minutes : MINUTES_PER_DAY;

  return {
    session,
    dateKey: startParts.dateKey,
    startMin: startParts.minutes,
    endMin: Math.max(endMin, startParts.minutes),
    col: 0,
    cols: 1,
  };
}

// Packs one day's blocks into side-by-side columns wherever they overlap.
export function layoutDay(blocks: CalendarBlock[], minMinutes: number = MIN_BLOCK_MINUTES): CalendarBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cluster: CalendarBlock[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    cluster.forEach((block) => {
      block.cols = columnEnds.length;
    });
    cluster = [];
    clusterEnd = -1;
    columnEnds = [];
  };

  for (const block of sorted) {
    const visualEnd = Math.max(block.endMin, block.startMin + minMinutes);

    if (cluster.length > 0 && block.startMin >= clusterEnd) {
      flush();
    }

    let col = columnEnds.findIndex((end) => end <= block.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[col] = visualEnd;
    block.col = col;

    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, visualEnd);
  }
  flush();

  return sorted;
}

export function buildWeek(
  sessions: FocusSession[],
  weekStart: string,
  minMinutes: number = MIN_BLOCK_MINUTES
): Record<string, CalendarBlock[]> {
  const byDay: Record<string, CalendarBlock[]> = {};
  for (const day of weekDays(weekStart)) {
    byDay[day] = [];
  }

  for (const session of sessions) {
    const block = sessionToBlock(session);
    if (byDay[block.dateKey]) {
      byDay[block.dateKey].push(block);
    }
  }

  for (const day of Object.keys(byDay)) {
    byDay[day] = layoutDay(byDay[day], minMinutes);
  }
  return byDay;
}

// Sessions are filtered server-side by UTC end time but bucketed here by their
// own tz's local date, so widen the window by a day on each side.
export function weekQueryRange(weekStart: string): { start_date: string; end_date: string } {
  return {
    start_date: `${addDays(weekStart, -1)}T00:00:00`,
    end_date: `${addDays(weekStart, 8)}T00:00:00`,
  };
}

// ----- Display helpers -----

export function formatMinutes(minutes: number): string {
  const total = Math.floor(minutes) % MINUTES_PER_DAY;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours < 12 ? 'AM' : 'PM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(mins).padStart(2, '0')} ${suffix}`;
}

export function formatHourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${suffix}`;
}

// One colour per category, spread around the hue wheel by alphabetical index
// so neighbours in the list are far apart in hue.
export function categoryColors(categories: string[]): Map<string, string> {
  const sorted = [...new Set(categories)].sort((a, b) => a.localeCompare(b));
  const colors = new Map<string, string>();
  sorted.forEach((category, index) => {
    const hue = Math.round((index * 137.508) % 360);
    colors.set(category, `hsl(${hue}, 55%, 42%)`);
  });
  return colors;
}
