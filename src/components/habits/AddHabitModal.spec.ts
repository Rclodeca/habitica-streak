// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useHabitStore } from '../../store/habitStore';
import AddHabitModal from './AddHabitModal.vue';

enableAutoUnmount(afterEach);

describe('AddHabitModal', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountForm() {
    return mount(AddHabitModal, { props: { modelValue: true }, global: { plugins: [pinia], stubs: { teleport: true } } });
  }

  it('Daily opens with all seven days lit and reads Every day', () => {
    const w = mountForm();
    expect(w.findAll('button.day.on')).toHaveLength(7);
    expect(w.text()).toContain('Every day');
  });

  it('resting two days reads 5 days and forges a habit with those days', async () => {
    const w = mountForm();
    // Re-query each time: the teleport stub re-creates its children on every render.
    await w.findAll('button.day')[0].trigger('click');
    await w.findAll('button.day')[1].trigger('click');
    expect(w.text()).toContain('5 days');
    await w.find('input.name-input').setValue('Gym');
    await w.find('form').trigger('submit');
    expect(useHabitStore().habits[0].days).toEqual([2, 3, 4, 5, 6]);
  });

  it('all seven lit forges a plain daily', async () => {
    const w = mountForm();
    await w.find('input.name-input').setValue('Read');
    await w.find('form').trigger('submit');
    expect('days' in useHabitStore().habits[0]).toBe(false);
  });

  it('Weekly hides the week', async () => {
    const w = mountForm();
    await w.find('input[name="habit-period"][value="weekly"]').setValue(true);
    expect(w.find('button.day').exists()).toBe(false);
  });

  it('reopening the form resets to all seven', async () => {
    const w = mountForm();
    await w.findAll('button.day')[0].trigger('click');
    await w.setProps({ modelValue: false });
    await w.setProps({ modelValue: true });
    expect(w.findAll('button.day.on')).toHaveLength(7);
  });

  it('names the difficulties in words, without pips', () => {
    const w = mountForm();
    const titles = w.findAll('input[name="habit-difficulty"] + .card-title').map((t) => t.text());
    expect(titles).toEqual(['Easy', 'Medium', 'Hard']);
    expect(w.find('.pip').exists()).toBe(false);
  });
});
