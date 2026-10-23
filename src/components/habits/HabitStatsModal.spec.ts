// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createRng, dayOfWeekIndex } from '../../game-engine';
import type { Habit, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useHabitStore } from '../../store/habitStore';
import HabitStatsModal from './HabitStatsModal.vue';

enableAutoUnmount(afterEach);

describe('HabitStatsModal', () => {
  let pinia: ReturnType<typeof createPinia>;
  const today = dayOfWeekIndex(new Date());
  const notToday = (today + 1) % 7;
  const q = (selector: string) => document.body.querySelector(selector);
  const qa = (selector: string) => document.body.querySelectorAll<HTMLButtonElement>(selector);

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function addHabit(period: Period = 'daily', overrides: Partial<Habit> = {}) {
    const habitStore = useHabitStore();
    const added = habitStore.addHabit('Gym', period, 'medium', false, createRng(1));
    habitStore.updateHabit({ ...added, ...overrides });
    return added;
  }

  // Renders the popup from the store's live copy of the habit, the way HabitList does.
  function mountPopup() {
    const habitStore = useHabitStore();
    const Host = defineComponent(() => () => h(HabitStatsModal, { modelValue: true, habit: habitStore.habits[0] }));
    return mount(Host, { global: { plugins: [pinia] }, attachTo: document.body });
  }

  it('a plain daily shows its week, all lit, reading Every day', () => {
    addHabit();
    mountPopup();
    expect(qa('.skill-days button.day.on')).toHaveLength(7);
    expect(q('.skill-days')?.textContent).toContain('Every day');
    expect(q('.skill-meta')?.textContent).not.toContain('Daily');
  });

  it('tapping a day saves it at once', async () => {
    addHabit();
    mountPopup();
    qa('.skill-days button.day')[notToday].click();
    await nextTick();
    expect(useHabitStore().habits[0].days).toHaveLength(6);
    expect(q('.skill-days')?.textContent).toContain('6 days');
  });

  it('a weekly shows no week', () => {
    addHabit('weekly');
    mountPopup();
    expect(q('.skill-days')).toBeNull();
    expect(q('.skill-meta')?.textContent).toContain('Weekly');
  });

  it('on a rest day the sum dims and Overdrive is disabled, even after checking it off', () => {
    const habit = addHabit('daily', { isOverdrive: true });
    useCombatActions().checkOffHabit(habit.id);
    useHabitStore().setHabitDays(habit.id, [notToday]);
    mountPopup();
    expect(q('.skill-sum')?.classList.contains('resting')).toBe(true);
    expect((q('button.overdrive-button') as HTMLButtonElement).disabled).toBe(true);
  });
});
