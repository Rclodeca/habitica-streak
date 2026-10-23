// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createRng, dayOfWeekIndex } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { TUNING } from '../../game-engine/constants/tuning';
import { useDebugClockStore } from '../../store/debugClockStore';
import { useHabitStore } from '../../store/habitStore';
import HabitList from './HabitList.vue';
import { WEEKDAY_SHORT } from './weekdays';

enableAutoUnmount(afterEach);

describe('HabitList', () => {
  let pinia: ReturnType<typeof createPinia>;
  const today = dayOfWeekIndex(new Date());

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function addDaily(days?: number[], overrides: Partial<Habit> = {}) {
    const habitStore = useHabitStore();
    const added = habitStore.addHabit('Gym', 'daily', 'medium', false, createRng(1), days);
    habitStore.updateHabit({ ...added, ...overrides });
    return added;
  }

  function mountList() {
    return mount(HabitList, { global: { plugins: [pinia] }, attachTo: document.body });
  }

  it('a habit resting today sits in a closed Resting fold with its next due day', () => {
    addDaily([(today + 2) % 7]);
    const wrapper = mountList();
    const fold = wrapper.find('details.rest-fold');
    expect(fold.exists()).toBe(true);
    expect((fold.element as HTMLDetailsElement).open).toBe(false);
    expect(fold.find('summary').text()).toContain('Resting');
    expect(fold.find('.rest-count').text()).toBe('1');
    expect(fold.find('.next-day').text()).toBe(WEEKDAY_SHORT[(today + 2) % 7]);
    expect((fold.find('input.check').element as HTMLInputElement).disabled).toBe(true);
  });

  it('shows no Resting fold when nothing rests today', () => {
    addDaily([today]);
    const wrapper = mountList();
    expect(wrapper.find('details.rest-fold').exists()).toBe(false);
  });

  it('resting follows the debug clock', async () => {
    addDaily([today]);
    const wrapper = mountList();
    useDebugClockStore().offsetMs = 24 * 60 * 60 * 1000;
    await nextTick();
    expect(wrapper.find('details.rest-fold').exists()).toBe(true);
  });

  it('the popup’s Overdrive button lights its charges once the skill lands, and greys one per use', async () => {
    addDaily(undefined, { isOverdrive: true });
    const wrapper = mountList();
    const check = wrapper.find('input.check');
    await wrapper.find('li').trigger('click'); // opens the popup
    const charges = (state: string) => document.body.querySelectorAll(`.overdrive-button .charge.${state}`).length;

    expect(document.body.querySelectorAll('.overdrive-button .charge')).toHaveLength(TUNING.OVERDRIVE_MAX_EXTRA_USES);
    expect(charges('ready')).toBe(0);

    await check.trigger('click');
    expect(charges('ready')).toBe(TUNING.OVERDRIVE_MAX_EXTRA_USES);

    await check.trigger('click');
    expect(charges('used')).toBe(1);
    expect(charges('ready')).toBe(TUNING.OVERDRIVE_MAX_EXTRA_USES - 1);
  });
});
