// Re-runs the daily rollover while the app stays open. `useDailyRollover`
// only looks at the period boundary when it's called, and App.vue calls it
// once on load — but a phone app that's backgrounded (or a tab left open)
// across the 3am turnover isn't reloaded, so its popup never came up and a
// habit tapped afterwards stamped itself as already handled. This watches
// for the day key changing, on a slow timer and when the app comes back to
// the foreground, and runs the rollover then so the popup shows before
// anything can be tapped for the wrong day.

import { dailyPeriodKey } from '../game-engine';
import { useDebugClockStore } from '../store/debugClockStore';
import { useDailyRollover } from './useDailyRollover';

const CHECK_INTERVAL_MS = 30_000;

/** Starts watching; returns a function that stops it. `now` defaults to the app's (debug-offset) clock. */
export function useRolloverWatch(now: () => Date = () => useDebugClockStore().now()): () => void {
  let lastDayKey = dailyPeriodKey(now());

  function check(): void {
    const current = now();
    const dayKey = dailyPeriodKey(current);
    if (dayKey === lastDayKey) return;
    lastDayKey = dayKey;
    useDailyRollover(current);
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') check();
  }

  const timer = setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
