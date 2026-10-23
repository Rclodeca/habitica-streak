// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
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
});
