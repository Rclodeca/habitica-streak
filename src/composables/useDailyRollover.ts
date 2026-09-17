// Composable that walks every habit once per period-boundary crossing and
// queues a miss (via `useMissedSkillsGate().queueMiss`) for any habit that
// wasn't completed in the period immediately preceding the current one.
// Intended to run once on app mount (see `App.vue`) — not on a timer.
//
// Queuing, not applying: this only detects and records misses. The actual
// damage and `lastCheckedPeriodKey` stamp are deferred to
// `useMissedSkillsGate().acknowledge()`, once the player has seen the
// missed-skills popup and clicked OK — see that composable for why.
//
// MVP scope only: this detects "was the most recently completed period
// missed", not a backlog of every period missed while the app was closed.
// If the app was closed across multiple period boundaries, only the single
// immediately-preceding period is checked; earlier gaps are not backfilled.

import { periodKeyFor } from '../game-engine';
import type { Period } from '../game-engine';
import { useHabitStore } from '../store/habitStore';
import { useMissedSkillsGate } from './useMissedSkillsGate';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The period key of the period immediately preceding `date`'s period. */
function previousPeriodKey(period: Period, date: Date): string {
  const offsetMs = period === 'daily' ? MS_PER_DAY : 7 * MS_PER_DAY;
  return periodKeyFor(period, new Date(date.getTime() - offsetMs));
}

/**
 * Runs the daily/weekly rollover check against every habit's current
 * state. For each habit whose period has advanced since it was last
 * checked: if it wasn't completed in the immediately-preceding period,
 * queues a miss (leaving `lastCheckedPeriodKey` untouched until that miss
 * is acknowledged); otherwise stamps `lastCheckedPeriodKey` to the current
 * period key immediately, since there's nothing to gate on.
 */
export function useDailyRollover(now: Date = new Date()): void {
  const habitStore = useHabitStore();
  const { queueMiss } = useMissedSkillsGate();

  for (const habit of habitStore.habits) {
    const currentPeriodKey = periodKeyFor(habit.period, now);
    if (habit.lastCheckedPeriodKey === currentPeriodKey) continue; // no boundary crossed

    const precedingPeriodKey = previousPeriodKey(habit.period, now);
    if (habit.lastCompletedPeriodKey !== precedingPeriodKey) {
      queueMiss(habit, currentPeriodKey);
      continue; // stamping deferred until the miss is acknowledged
    }

    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: currentPeriodKey });
  }
}
