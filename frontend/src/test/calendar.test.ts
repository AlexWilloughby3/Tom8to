import { describe, it, expect } from 'vitest';
import type { FocusSession } from '../types';
import {
  addDays,
  buildWeek,
  categoryColors,
  formatMinutes,
  isDateKey,
  layoutDay,
  mondayOf,
  parseUtc,
  sessionToBlock,
  toNaiveUtc,
  weekDays,
  weekQueryRange,
  zonedToUtc,
  type CalendarBlock,
} from '../utils/calendar';
import { mergeShortStretches, totalSeconds } from '../utils/stretches';

function session(time: string, seconds: number, tz = 'America/New_York', category = 'Work'): FocusSession {
  return { email: 'testuser@example.com', time, focus_time_seconds: seconds, category, tz };
}

function block(startMin: number, endMin: number): CalendarBlock {
  return { session: session(`2026-09-29T00:00:${startMin}`, 0), dateKey: '2026-09-29', startMin, endMin, col: 0, cols: 1 };
}

describe('week maths', () => {
  it('snaps any day to its Monday', () => {
    expect(mondayOf('2026-10-03')).toBe('2026-09-28'); // Saturday
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sunday
    expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // Monday
  });

  it('lists seven days across a month boundary', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('validates date keys', () => {
    expect(isDateKey('2026-10-03')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('next week')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('pads the query window by a day on each side', () => {
    expect(weekQueryRange('2026-09-28')).toEqual({
      start_date: '2026-09-27T00:00:00',
      end_date: '2026-10-06T00:00:00',
    });
  });
});

describe('timestamps', () => {
  it('treats naive API timestamps as UTC', () => {
    expect(parseUtc('2026-10-03T14:00:00').toISOString()).toBe('2026-10-03T14:00:00.000Z');
    expect(parseUtc('2026-10-03T14:00:00Z').toISOString()).toBe('2026-10-03T14:00:00.000Z');
    expect(parseUtc('2026-10-03T10:00:00-04:00').toISOString()).toBe('2026-10-03T14:00:00.000Z');
  });

  it('writes naive UTC for query params', () => {
    expect(toNaiveUtc(new Date('2026-10-03T14:00:00Z'))).toBe('2026-10-03T14:00:00.000');
  });
});

describe('sessionToBlock', () => {
  it('places a session by wall-clock time in its own tz', () => {
    // 14:00 UTC is 10:00 EDT; a one-hour session ran 9:00-10:00
    const eastern = sessionToBlock(session('2026-10-01T14:00:00', 3600, 'America/New_York'));
    expect(eastern).toMatchObject({ dateKey: '2026-10-01', startMin: 540, endMin: 600 });

    // The same instant logged in Chicago ran 8:00-9:00
    const central = sessionToBlock(session('2026-10-01T14:00:00', 3600, 'America/Chicago'));
    expect(central).toMatchObject({ dateKey: '2026-10-01', startMin: 480, endMin: 540 });
  });

  it('keeps a session ending at local midnight on the day it started', () => {
    // 04:00 UTC is 00:00 EDT on Oct 2
    const result = sessionToBlock(session('2026-10-02T04:00:00', 1800, 'America/New_York'));
    expect(result).toMatchObject({ dateKey: '2026-10-01', startMin: 1410, endMin: 1440 });
  });

  it('uses wall-clock times across a DST change', () => {
    // Nov 1 2026: clocks fall back at 2:00 EDT. 08:00 UTC is 3:00 EST.
    const result = sessionToBlock(session('2026-11-01T08:00:00', 3600, 'America/New_York'));
    expect(result).toMatchObject({ dateKey: '2026-11-01', startMin: 120, endMin: 180 });
  });
});

describe('layoutDay', () => {
  it('gives non-overlapping blocks the full width', () => {
    const result = layoutDay([block(540, 600), block(600, 660)]);
    expect(result.map((b) => [b.col, b.cols])).toEqual([[0, 1], [0, 1]]);
  });

  it('puts overlapping blocks side by side', () => {
    const result = layoutDay([block(540, 600), block(570, 630), block(700, 760)]);
    expect(result.map((b) => [b.col, b.cols])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });

  it('reuses a column once it is free within a cluster', () => {
    const result = layoutDay([block(540, 720), block(550, 600), block(610, 660)]);
    expect(result.map((b) => [b.col, b.cols])).toEqual([[0, 2], [1, 2], [1, 2]]);
  });

  it('treats very short blocks as their minimum drawn length', () => {
    const result = layoutDay([block(540, 542), block(545, 547)], 20);
    expect(result.map((b) => [b.col, b.cols])).toEqual([[0, 2], [1, 2]]);
  });
});

describe('buildWeek', () => {
  it('buckets sessions into the week by their own local date', () => {
    const week = buildWeek(
      [
        session('2026-09-28T13:00:00', 1800), // Mon 9:00 EDT
        session('2026-09-28T03:00:00', 1800), // Sun 23:00 EDT: previous week
        session('2026-10-05T03:30:00', 1800), // Sun 23:30 EDT: still this week
        session('2026-10-05T13:00:00', 1800), // next Monday
      ],
      '2026-09-28'
    );
    expect(week['2026-09-28']).toHaveLength(1);
    expect(week['2026-10-04']).toHaveLength(1);
    expect(Object.values(week).flat()).toHaveLength(2);
  });
});

describe('display helpers', () => {
  it('formats minutes as a 12-hour clock', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(545.5)).toBe('9:05 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(1410)).toBe('11:30 PM');
  });

  it('gives each category its own colour regardless of input order', () => {
    const a = categoryColors(['Work', 'Study', 'Gym']);
    const b = categoryColors(['Gym', 'Work', 'Study', 'Work']);
    expect(new Set(a.values()).size).toBe(3);
    expect(b.get('Work')).toBe(a.get('Work'));
  });
});

describe('mergeShortStretches', () => {
  it('leaves long stretches alone', () => {
    const stretches = [{ end: 1000, seconds: 1500 }, { end: 2000, seconds: 1500 }];
    expect(mergeShortStretches(stretches)).toEqual(stretches);
  });

  it('folds a short stretch into the previous one', () => {
    const result = mergeShortStretches([{ end: 1000, seconds: 600 }, { end: 2000, seconds: 10 }]);
    expect(result).toEqual([{ end: 2000, seconds: 610 }]);
  });

  it('folds a leading short stretch into the next one', () => {
    const result = mergeShortStretches([{ end: 1000, seconds: 10 }, { end: 2000, seconds: 600 }]);
    expect(result).toEqual([{ end: 2000, seconds: 610 }]);
  });

  it('keeps a session made only of short stretches', () => {
    const result = mergeShortStretches([{ end: 1000, seconds: 10 }, { end: 2000, seconds: 20 }]);
    expect(result).toEqual([{ end: 2000, seconds: 30 }]);
  });

  it('never changes the total', () => {
    const stretches = [
      { end: 1, seconds: 5 }, { end: 2, seconds: 900 }, { end: 3, seconds: 30 },
      { end: 4, seconds: 0 }, { end: 5, seconds: 59 }, { end: 6, seconds: 60 },
    ];
    expect(totalSeconds(mergeShortStretches(stretches))).toBe(totalSeconds(stretches));
  });
});

describe('zonedToUtc', () => {
  it('converts a wall-clock time in a tz to the right instant', () => {
    expect(zonedToUtc('2026-10-01', 540, 'America/New_York').toISOString()).toBe('2026-10-01T13:00:00.000Z');
    expect(zonedToUtc('2026-10-01', 540, 'America/Chicago').toISOString()).toBe('2026-10-01T14:00:00.000Z');
    expect(zonedToUtc('2026-01-15', 0, 'Asia/Kolkata').toISOString()).toBe('2026-01-14T18:30:00.000Z');
  });

  it('uses the right offset on either side of a DST change', () => {
    // Nov 1 2026: New York falls back from EDT (UTC-4) to EST (UTC-5) at 2:00
    expect(zonedToUtc('2026-11-01', 30, 'America/New_York').toISOString()).toBe('2026-11-01T04:30:00.000Z');
    expect(zonedToUtc('2026-11-01', 180, 'America/New_York').toISOString()).toBe('2026-11-01T08:00:00.000Z');
  });

  it('round-trips with sessionToBlock', () => {
    const start = zonedToUtc('2026-10-01', 615, 'America/Los_Angeles');
    const end = new Date(start.getTime() + 45 * 60000);
    const result = sessionToBlock(session(end.toISOString(), 45 * 60, 'America/Los_Angeles'));
    expect(result).toMatchObject({ dateKey: '2026-10-01', startMin: 615, endMin: 660 });
  });
});
