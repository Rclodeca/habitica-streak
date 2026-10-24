// Composable that walks every habit once per period-boundary crossing and
// queues an outcome (via `useMissedSkillsGate`) for any habit that wasn't
// completed in the period immediately preceding the current one. Intended
// to run once on app mount (see `App.vue`) — not on a timer.
//
// "Not completed" means opposite things for opposite habit kinds: for a
// good habit it's a miss (`queueMiss` — penalty); for a bad habit it means
// the player avoided it, which is the win condition (`queueReward`). See
// `Habit.isBad` in types.ts and `useCombatActions` for the full reasoning.
//
// Queuing, not applying: this only detects and records outcomes. The actual
// damage/healing and `lastCheckedPeriodKey` stamp are deferred to
// `useMissedSkillsGate().acknowledge()`, once the player has seen the
// popup and clicked OK — see that composable for why.
//
// MVP scope only: this detects "was the most recently completed period
// missed", not a backlog of every period missed while the app was closed.
// If the app was closed across multiple period boundaries, only the single
// immediately-preceding period is checked; earlier gaps are not backfilled.
//
// A set-day habit is resolved against its most recent due day since it was
// last checked rather than literally yesterday, so a missed Monday still
// counts when the app first opens on Wednesday after a Tuesday rest day. If
// it only rested since, there's nothing to resolve and it's just stamped.

import { applyDailyRegen, dailyPeriodKey, daysBetweenDayKeys, isDueOn, periodKeyFor } from '../game-engine';
import type { Habit, Period } from '../game-engine';
import { useActivityLogStore } from '../store/activityLogStore';
import { useCharacterStore } from '../store/characterStore';
import { useHabitStore } from '../store/habitStore';
import { useQuestStore } from '../store/questStore';
import { useMissedSkillsGate } from './useMissedSkillsGate';
import { useQuestMissGate } from './useQuestMissGate';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The period key of the period immediately preceding `date`'s period. */
function previousPeriodKey(period: Period, date: Date): string {
  const offsetMs = period === 'daily' ? MS_PER_DAY : 7 * MS_PER_DAY;
  return periodKeyFor(period, new Date(date.getTime() - offsetMs));
}

/**
 * The period key a habit's rollover resolves: the period just before `now`
 * — or, for a set-day daily, its most recent due day (at most a week back)
 * no earlier than `lastCheckedPeriodKey`. Undefined when it only rested.
 */
function periodKeyToResolve(habit: Habit, now: Date): string | undefined {
  if (habit.period !== 'daily' || !habit.days) return previousPeriodKey(habit.period, now);
  for (let back = 1; back <= 7; back++) {
    const day = new Date(now.getTime() - back * MS_PER_DAY);
    const dayKey = dailyPeriodKey(day);
    if (habit.lastCheckedPeriodKey && daysBetweenDayKeys(habit.lastCheckedPeriodKey, dayKey) < 0) return undefined;
    if (isDueOn(habit, day)) return dayKey;
  }
  return undefined;
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
  const { queueMiss, queueReward } = useMissedSkillsGate();
  const questStore = useQuestStore();
  const { queueMiss: queueQuestMiss } = useQuestMissGate();

  for (const habit of habitStore.habits) {
    const currentPeriodKey = periodKeyFor(habit.period, now);
    if (habit.lastCheckedPeriodKey === currentPeriodKey) continue; // no boundary crossed

    const keyToResolve = periodKeyToResolve(habit, now);
    if (keyToResolve !== undefined && habit.lastCompletedPeriodKey !== keyToResolve) {
      // Not completed in the preceding period: a miss for a good habit, but
      // the win condition (avoided) for a bad one.
      if (habit.isBad) {
        queueReward(habit, currentPeriodKey);
      } else {
        queueMiss(habit, currentPeriodKey);
      }
      continue; // stamping deferred until the outcome is acknowledged
    }

    habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: currentPeriodKey });
  }

  const todayKey = dailyPeriodKey(now);
  // Ember Heart's once-a-day heal (a no-op without it, or if it already ran today).
  const characterStore = useCharacterStore();
  const regen = applyDailyRegen(characterStore.character, todayKey);
  if (regen.character !== characterStore.character) {
    characterStore.setCharacter(regen.character);
    if (regen.healed > 0) useActivityLogStore().addEntry({ kind: 'item-heal', itemName: 'Ember Heart', amount: regen.healed });
  }

  for (const quest of questStore.quests) {
    if (daysBetweenDayKeys(quest.dueDateKey, todayKey) > 0) {
      queueQuestMiss(quest);
    }
  }
}
