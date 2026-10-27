// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createRng, dailyPeriodKey, dayOfWeekIndex } from '../../game-engine';
import type { Habit, Period } from '../../game-engine';
import { useCombatActions } from '../../composables/useCombatActions';
import { useDebugClockStore } from '../../store/debugClockStore';
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
  function mountPopup(index = 0) {
    const habitStore = useHabitStore();
    const Host = defineComponent(() => () => h(HabitStatsModal, { modelValue: true, habit: habitStore.habits[index] }));
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

  it('a skill added today can\'t be removed until tomorrow', async () => {
    const clock = useDebugClockStore();
    addHabit('daily', { createdDayKey: dailyPeriodKey(clock.now()) });
    mountPopup();
    const button = q('.remove-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Tomorrow');
    button.click();
    await nextTick();
    expect(q('.confirm-text')).toBeNull();

    clock.skipToNextDay();
    await nextTick();
    expect((q('.remove-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a skill added yesterday can be removed', () => {
    const yesterday = new Date(useDebugClockStore().now().getTime() - 24 * 60 * 60 * 1000);
    addHabit('daily', { createdDayKey: dailyPeriodKey(yesterday) });
    mountPopup();
    expect((q('.remove-button') as HTMLButtonElement).disabled).toBe(false);
    expect(q('.remove-button')?.textContent).not.toContain('Tomorrow');
  });

  describe('rank and sum', () => {
    const text = (selector: string) => (q(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sumRow = (label: string) =>
      [...document.body.querySelectorAll('.sum-row')].find((row) => row.querySelector('dt')?.textContent?.startsWith(label));
    const metaParts = () => text('.skill-meta').split('·').map((part) => part.trim());

    it('names the type, period and difficulty in words, without pips', () => {
      addHabit('daily', { damageType: 'physical', difficulty: 'hard' });
      mountPopup();
      expect(metaParts()).toEqual(['Physical', 'Hard']);
      expect(q('.skill-meta .pip')).toBeNull();
    });

    it('a weekly adds its period', () => {
      addHabit('weekly', { damageType: 'magic', difficulty: 'medium' });
      mountPopup();
      expect(metaParts()).toEqual(['Magic', 'Weekly', 'Medium']);
    });

    it('a ranked skill shows its rank, diamonds, the way to the next, and the Rank and Streak lines', () => {
      addHabit('daily', { damageType: 'physical', rank: 5, streakCount: 112 });
      mountPopup();
      expect(text('.rank-label')).toBe('Rank V');
      expect(document.body.querySelectorAll('.rank-block .rank-diamonds i')).toHaveLength(5);
      expect(text('.rank-caption')).toContain('VI at 200');
      expect((q('.rank-bar i') as HTMLElement).style.width).toBe('56%');
      expect(sumRow('Rank')?.querySelector('dd')?.textContent).toBe('×6.0');
      // Rank and streak add into 1 + 5 + 1.12 = 7.12; the streak row is 7.12 / 6.
      expect(sumRow('Streak')?.querySelector('dd')?.textContent).toBe('×1.19');
    });

    it('a weekly counts weeks', () => {
      addHabit('weekly', { rank: 2, streakCount: 9 });
      mountPopup();
      expect(text('.rank-caption')).toContain('9 wk');
      expect(text('.rank-caption')).toContain('III at 10 wk');
    });

    it('an unranked skill reads Unranked and shows no rank bonus', () => {
      addHabit('daily', { rank: 0, streakCount: 4 });
      mountPopup();
      expect(text('.rank-label')).toBe('Unranked');
      expect(text('.rank-caption')).toContain('I at 10');
      expect(sumRow('Rank')?.querySelector('dd')?.textContent).toBe('—');
    });

    it('rank VIII fills the bar with nothing left to reach', () => {
      addHabit('daily', { rank: 8, streakCount: 520 });
      mountPopup();
      expect((q('.rank-bar i') as HTMLElement).style.width).toBe('100%');
      expect(text('.rank-caption')).not.toContain(' at ');
    });

    it('a healing rank is worth a quarter', () => {
      addHabit('daily', { damageType: 'healing', rank: 2 });
      mountPopup();
      expect(sumRow('Rank')?.querySelector('dd')?.textContent).toBe('×1.5');
    });

    it('marks the 16th skill\'s Base crowded, and not the first\'s', () => {
      const habitStore = useHabitStore();
      for (let i = 0; i < 16; i++) habitStore.addHabit(`S${i}`, 'daily', 'medium', false, createRng(i + 1));
      const first = mountPopup(0);
      expect(sumRow('Base')?.textContent).not.toContain('crowded');
      first.unmount();
      mountPopup(15);
      expect(sumRow('Base')?.querySelector('small.crowded')?.textContent).toBe('crowded');
    });
  });
});
