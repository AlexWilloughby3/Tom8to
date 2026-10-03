// A stretch is one unbroken run of focus time between a start/resume and a
// pause/stop. Timers save one session per stretch so pauses and breaks show
// up as gaps on the calendar.
export interface Stretch {
  end: number; // epoch ms when the stretch stopped
  seconds: number; // focus seconds counted by the timer during it
}

export const MIN_STRETCH_SECONDS = 60;

// Folds stretches shorter than minSeconds into a neighbour (the previous one
// if there is one, otherwise the next) so a quick pause/resume doesn't create
// a tiny session of its own. No time is dropped: the total is unchanged.
export function mergeShortStretches(
  stretches: Stretch[],
  minSeconds: number = MIN_STRETCH_SECONDS
): Stretch[] {
  const merged: Stretch[] = [];
  let carry = 0;
  let lastEnd = 0;

  for (const stretch of stretches) {
    if (stretch.seconds <= 0) continue;
    lastEnd = stretch.end;

    if (stretch.seconds < minSeconds) {
      const previous = merged[merged.length - 1];
      if (previous) {
        merged[merged.length - 1] = {
          end: stretch.end,
          seconds: previous.seconds + stretch.seconds,
        };
      } else {
        carry += stretch.seconds;
      }
    } else {
      merged.push({ end: stretch.end, seconds: stretch.seconds + carry });
      carry = 0;
    }
  }

  // Every stretch was short: save them as one session
  if (carry > 0) {
    merged.push({ end: lastEnd, seconds: carry });
  }

  return merged;
}

export function totalSeconds(stretches: Stretch[]): number {
  return stretches.reduce((sum, stretch) => sum + stretch.seconds, 0);
}
