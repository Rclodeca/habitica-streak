// @vitest-environment jsdom

import { enableAutoUnmount, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '../../store/characterStore';
import AppShell from './AppShell.vue';

enableAutoUnmount(afterEach);

describe('AppShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCharacterStore().character.name = 'Ash';
  });

  it('puts the stage on top, skills on the left, quests and the log on the right', () => {
    const wrapper = shallowMount(AppShell);
    const layout = wrapper.find('.layout');
    expect(layout.element.firstElementChild!.tagName.toLowerCase()).toBe('fight-stage-stub');
    expect(layout.find('.main progress-summary-stub').exists()).toBe(true);
    expect(layout.find('.main habit-list-stub').exists()).toBe(true);
    expect(layout.find('.side quest-section-stub').exists()).toBe(true);
    expect(layout.find('.side activity-log-stub').exists()).toBe(true);
  });
});
