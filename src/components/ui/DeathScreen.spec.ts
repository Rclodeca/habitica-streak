// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDeathScreen } from '../../composables/useDeathScreen';
import { createRng } from '../../game-engine';
import type { Habit } from '../../game-engine';
import { useHabitStore } from '../../store/habitStore';
import DeathScreen from './DeathScreen.vue';

enableAutoUnmount(afterEach);

describe('DeathScreen', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    useDeathScreen().triggerDeath();
  });

  afterEach(() => useDeathScreen().dismiss());

  function mountWith(skills: Partial<Habit>[]) {
    const habitStore = useHabitStore();
    skills.forEach((overrides, i) => {
      const added = habitStore.addHabit(`Skill ${i}`, 'daily', 'medium', false, createRng(i + 1));
      habitStore.updateHabit({ ...added, ...overrides });
    });
    return mount(DeathScreen, { global: { plugins: [pinia] }, attachTo: document.body });
  }

  const embers = () => [...document.querySelectorAll('.ember')];

  it('shows an ember per ranked or streaking skill, strongest first', () => {
    mountWith([
      { rank: 1, streakCount: 12 },
      { rank: 0, streakCount: 0 },
      { rank: 5, streakCount: 112 },
      { rank: 3, streakCount: 0 },
    ]);
    expect(embers().map((el) => el.querySelector('.numeral')!.textContent)).toEqual(['V', 'III', 'I']);
    expect(embers().map((el) => el.querySelector('.streak')!.textContent!.trim())).toEqual(['112', '—', '12']);
  });

  it('marks a skill whose streak broke as cold', () => {
    mountWith([{ rank: 3, streakCount: 0 }, { rank: 2, streakCount: 9 }]);
    expect(embers().map((el) => el.classList.contains('cold'))).toEqual([true, false]);
  });

  it('drops the kept-skills section when nothing carries over', () => {
    mountWith([{ rank: 0, streakCount: 0 }]);
    expect(document.querySelector('.kept')).toBeNull();
    expect(embers()).toHaveLength(0);
  });
});
