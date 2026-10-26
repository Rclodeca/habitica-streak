// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { createRng } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useHabitStore } from '../../store/habitStore';
import HabitListItem from './HabitListItem.vue';

enableAutoUnmount(afterEach);

describe('HabitListItem', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  // Renders the row from the store's live copy of the habit, the way
  // HabitList does, so every combat action re-renders it.
  function mountSkill(overrides: Partial<Habit> = {}) {
    const habitStore = useHabitStore();
    const added = habitStore.addHabit('Read', 'daily', 'medium', false, createRng(1));
    habitStore.updateHabit({ ...added, ...overrides });
    const Host = defineComponent(() => () => h(HabitListItem, { habit: habitStore.habits[0] }));
    return mount(Host, { global: { plugins: [pinia] }, attachTo: document.body });
  }

  // Mounts the row itself, so its `open` emit can be watched.
  function mountRow(overrides: Partial<Habit> = {}) {
    const habitStore = useHabitStore();
    const added = habitStore.addHabit('Read', 'daily', 'medium', false, createRng(1));
    habitStore.updateHabit({ ...added, ...overrides });
    return mount(HabitListItem, { props: { habit: habitStore.habits[0] }, global: { plugins: [pinia] }, attachTo: document.body });
  }

  it('a tap on the check zone around the box completes the skill and leaves the details closed', async () => {
    const wrapper = mountRow();

    await wrapper.find('.check-zone').trigger('click');

    expect(useHabitStore().habits[0].lastCompletedPeriodKey).not.toBeNull();
    expect(wrapper.emitted('open')).toBeUndefined();
  });

  it('a tap on the name opens the details and completes nothing', async () => {
    const wrapper = mountRow();

    await wrapper.find('.name').trigger('click');

    expect(wrapper.emitted('open')).toHaveLength(1);
    expect(useHabitStore().habits[0].lastCompletedPeriodKey).toBeNull();
  });

  it('a tap on the check zone of a done skill still opens the details', async () => {
    const wrapper = mountRow();
    await wrapper.find('.check-zone').trigger('click'); // lands the skill
    await wrapper.setProps({ habit: useHabitStore().habits[0] });

    await wrapper.find('.check-zone').trigger('click');

    expect(wrapper.emitted('open')).toHaveLength(1);
  });

  it('a second tap on a done Overdrive skill spends one charge and leaves it checked', async () => {
    const wrapper = mountSkill({ isOverdrive: true });
    const check = wrapper.find('input.check');

    await check.trigger('click'); // lands the skill
    await check.trigger('click'); // overdrives it

    expect(useHabitStore().habits[0].overdriveUsesThisPeriod).toBe(1);
    expect((check.element as HTMLInputElement).checked).toBe(true);
  });

  it('a done Overdrive skill keeps its halo until its charges are spent', async () => {
    const wrapper = mountSkill({ isOverdrive: true });
    const check = wrapper.find('input.check');
    expect(check.classes()).not.toContain('overdrive-ready');

    await check.trigger('click');
    expect(check.classes()).toContain('overdrive-ready');

    for (let i = 0; i < TUNING.OVERDRIVE_MAX_EXTRA_USES; i++) await check.trigger('click');
    expect(check.classes()).not.toContain('overdrive-ready');
    expect(check.attributes('disabled')).toBeDefined();
  });

  describe('rank', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows one diamond per rank, none unranked, and no difficulty pips', () => {
      const unranked = mountSkill({ rank: 0 });
      expect(unranked.find('.rank-diamonds').exists()).toBe(false);
      expect(unranked.find('.pips').exists()).toBe(false);
      unranked.unmount();
      setActivePinia((pinia = createPinia()));
      const ranked = mountSkill({ rank: 3 });
      expect(ranked.findAll('.rank-diamonds i')).toHaveLength(3);
      expect(ranked.find('.rank-diamonds').attributes('aria-label')).toBe('Rank III');
    });

    it('flares the row once on a rank-up, then clears', async () => {
      vi.useFakeTimers();
      const wrapper = mountSkill({ rank: 2 });
      const habitStore = useHabitStore();
      habitStore.updateHabit({ ...habitStore.habits[0], rank: 3 });
      await nextTick();
      expect(wrapper.find('.habit-item').classes()).toContain('flare');
      expect(wrapper.find('.rank-ghost').text()).toBe('Rank III');
      vi.advanceTimersByTime(2400);
      await nextTick();
      expect(wrapper.find('.habit-item').classes()).not.toContain('flare');
      expect(wrapper.find('.rank-ghost').exists()).toBe(false);
    });

    it('plays nothing on a streak-only change or when mounted ranked', async () => {
      const wrapper = mountSkill({ rank: 5, streakCount: 60 });
      expect(wrapper.find('.habit-item').classes()).not.toContain('flare');
      const habitStore = useHabitStore();
      habitStore.updateHabit({ ...habitStore.habits[0], streakCount: 61 });
      await nextTick();
      expect(wrapper.find('.habit-item').classes()).not.toContain('flare');
    });
  });
});
