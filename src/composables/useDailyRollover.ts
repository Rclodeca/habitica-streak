// Composable that walks every habit once per period-boundary crossing and
// records a miss (via `useCombatActions().checkMissedHabit`) for any habit
// that wasn't completed in the period immediately preceding the current
// one. Intended to run once on app mount (see `App.vue`) — not on a timer.
//
// MVP scope only: this detects "was the most recently completed period
// missed", not a backlog of every period missed while the app was closed.
// If the app was closed across multiple period boundaries, only the single
// immediately-preceding period is checked; earlier gaps are not backfilled.

import { periodKeyFor } from '../game-engine';
import type { Period } from '../game-engine';
import { useHabitStore } from '../store/habitStore';
import { useCombatActions } from './useCombatActions';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The period key of the period immediately preceding `date`'s period. */
function previousPeriodKey(period: Period, date: Date): string {
  const offsetMs = period === 'daily' ? MS_PER_DAY : 7 * MS_PER_DAY;
  return periodKeyFor(period, new Date(date.getTime() - offsetMs));
}

/**
 * Runs the daily/weekly rollover check against every habit's current
 * state. For each habit whose period has advanced since it was last
 * checked, if it wasn't completed in the immediately-preceding period,
 * records a miss via `checkMissedHabit`. Either way, stamps
 * `lastCheckedPeriodKey` to the current period key afterward.
 */
export function useDailyRollover(now: Date = new Date()): void {
  const habitStore = useHabitStore();
  const { checkMissedHabit } = useCombatActions();

  // Snapshot ids up front: `checkMissedHabit` (and the player-death
  // resolution it may trigger) can replace habit objects/arrays in the
  // store mid-loop, so we look each habit up fresh by id on every step
  // rather than iterating the live array directly.
  const habitIds = habitStore.habits.map((habit) => habit.id);

  for (const habitId of habitIds) {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) continue;

    const currentPeriodKey = periodKeyFor(habit.period, now);
    if (habit.lastCheckedPeriodKey === currentPeriodKey) continue; // no boundary crossed

    const precedingPeriodKey = previousPeriodKey(habit.period, now);
    if (habit.lastCompletedPeriodKey !== precedingPeriodKey) {
      checkMissedHabit(habitId);
    }

    const latest = habitStore.habits.find((h) => h.id === habitId);
    if (latest) {
      habitStore.updateHabit({ ...latest, lastCheckedPeriodKey: currentPeriodKey });
    }
  }
}
