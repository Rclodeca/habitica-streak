// Small shared (module-scoped) queue of habits missed during the last
// daily/weekly rollover — same singleton reasoning as `useDeathScreen`: the
// code that detects misses (`useDailyRollover`) and the component that
// renders the blocking popup (`MissedSkillsPopup`, mounted once in
// `AppShell`) must see the same state.
//
// Detection and resolution are deliberately split: `queueMiss` only records
// that a habit was missed — it never touches character/boss health. The
// actual damage (and the floating damage-popup animation it drives) is
// applied by `acknowledge()`, once the player has seen the list and clicked
// OK, so damage never happens off-screen before the popup shows. Each
// queued miss's `lastCheckedPeriodKey` stamp is deferred the same way: it's
// written by `acknowledge()`, not at detection time, so a miss that's
// queued but never acknowledged (app closed before the popup is dismissed)
// is detected again next launch instead of silently skipped.

import { computed, ref } from 'vue';
import type { Habit } from '../game-engine';
import { useCombatActions } from './useCombatActions';
import { useHabitStore } from '../store/habitStore';

interface PendingMiss {
  habitId: string;
  habitName: string;
  periodKeyToStamp: string;
}

const pending = ref<PendingMiss[]>([]);

export function useMissedSkillsGate() {
  const habitStore = useHabitStore();
  const { checkMissedHabit } = useCombatActions();

  const misses = computed(() => pending.value);
  const hasPending = computed(() => pending.value.length > 0);

  /** Records a miss for `habit`, stamping `periodKeyToStamp` once acknowledged. */
  function queueMiss(habit: Habit, periodKeyToStamp: string) {
    pending.value.push({ habitId: habit.id, habitName: habit.name, periodKeyToStamp });
  }

  /**
   * Applies every queued miss's damage (via the same `checkMissedHabit`
   * used for a live habit check) and stamps its deferred `lastCheckedPeriodKey`,
   * then clears the queue.
   */
  function acknowledge() {
    for (const miss of pending.value) {
      checkMissedHabit(miss.habitId);
      const habit = habitStore.habits.find((h) => h.id === miss.habitId);
      if (habit) {
        habitStore.updateHabit({ ...habit, lastCheckedPeriodKey: miss.periodKeyToStamp });
      }
    }
    pending.value = [];
  }

  return { misses, hasPending, queueMiss, acknowledge };
}
