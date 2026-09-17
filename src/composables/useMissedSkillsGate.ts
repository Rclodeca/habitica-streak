// Small shared (module-scoped) queue of habit outcomes detected during the
// last daily/weekly rollover — same singleton reasoning as `useDeathScreen`:
// the code that detects them (`useDailyRollover`) and the component that
// renders the blocking popup (`MissedSkillsPopup`, mounted once in
// `AppShell`) must see the same state.
//
// Two outcome kinds share this one queue: `queueMiss` (a good habit not
// completed — penalty) and `queueReward` (a bad habit not checked, i.e.
// avoided — reward). See `useDailyRollover` for which one fires per habit.
//
// Detection and resolution are deliberately split: queuing only records the
// outcome — it never touches character/boss health. The actual
// damage/healing (and the floating damage-popup animation it drives) is
// applied by `acknowledge()`, once the player has seen the list and clicked
// OK, so it never happens off-screen before the popup shows. Each queued
// item's `lastCheckedPeriodKey` stamp is deferred the same way: it's
// written by `acknowledge()`, not at detection time, so an outcome that's
// queued but never acknowledged (app closed before the popup is dismissed)
// is detected again next launch instead of silently skipped.

import { computed, ref } from 'vue';
import type { Habit } from '../game-engine';
import { useCombatActions } from './useCombatActions';
import { useHabitStore } from '../store/habitStore';
import { useItemDropQueue } from './useItemDropQueue';

interface PendingOutcome {
  habitId: string;
  habitName: string;
  periodKeyToStamp: string;
  outcome: 'penalty' | 'reward';
}

const pending = ref<PendingOutcome[]>([]);

export function useMissedSkillsGate() {
  const habitStore = useHabitStore();
  const { checkMissedHabit, checkAvoidedHabit } = useCombatActions();
  const { enqueueDrops } = useItemDropQueue();

  const misses = computed(() => pending.value.filter((item) => item.outcome === 'penalty'));
  const rewards = computed(() => pending.value.filter((item) => item.outcome === 'reward'));
  const hasPending = computed(() => pending.value.length > 0);

  /** Records a good-habit miss for `habit`, stamping `periodKeyToStamp` once acknowledged. */
  function queueMiss(habit: Habit, periodKeyToStamp: string) {
    pending.value.push({ habitId: habit.id, habitName: habit.name, periodKeyToStamp, outcome: 'penalty' });
  }

  /** Records a bad-habit avoidance reward for `habit`, stamping `periodKeyToStamp` once acknowledged. */
  function queueReward(habit: Habit, periodKeyToStamp: string) {
    pending.value.push({ habitId: habit.id, habitName: habit.name, periodKeyToStamp, outcome: 'reward' });
  }

  /**
   * Applies every queued outcome (penalty via `checkMissedHabit`, reward via
   * `checkAvoidedHabit` — enqueuing any items a reward's boss-kill drops)
   * and stamps its deferred `lastCheckedPeriodKey`, then clears the queue.
   */
  function acknowledge() {
    for (const item of pending.value) {
      if (item.outcome === 'penalty') {
        checkMissedHabit(item.habitId);
      } else {
        enqueueDrops(checkAvoidedHabit(item.habitId));
      }
      const habit = habitStore.habits.find((h) => h.id === item.habitId);
      if (habit) {
        habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: item.periodKeyToStamp });
      }
    }
    pending.value = [];
  }

  return { misses, rewards, hasPending, queueMiss, queueReward, acknowledge };
}
