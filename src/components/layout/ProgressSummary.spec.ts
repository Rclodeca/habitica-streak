// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng, dayOfWeekIndex } from '../../game-engine';
import { useHabitStore } from '../../store/habitStore';
import ProgressSummary from './ProgressSummary.vue';

describe('ProgressSummary', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('Daily done leaves out habits resting today', () => {
    const habitStore = useHabitStore();
    habitStore.addHabit('Read', 'daily', 'easy', false, createRng(1));
    habitStore.addHabit('Gym', 'daily', 'hard', false, createRng(1), [(dayOfWeekIndex(new Date()) + 1) % 7]);
    const wrapper = mount(ProgressSummary);
    expect(wrapper.findAll('.stat b')[0].text()).toBe('0 / 1');
  });
});
