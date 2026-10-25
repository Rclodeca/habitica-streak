// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONALITY_NAME } from '../../game-engine';
import { useBossStore } from '../../store/bossStore';
import { useCharacterStore } from '../../store/characterStore';
import BossBar from '../boss/BossBar.vue';
import FightStage from './FightStage.vue';

enableAutoUnmount(afterEach);

describe('FightStage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // jsdom has no ResizeObserver; the hero's stat line watches its own size.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mountStage = () => mount(FightStage, { global: { stubs: { teleport: true } } });

  it('holds the boss and the hero on one stage', () => {
    const wrapper = mountStage();
    expect(wrapper.find('.stage-inner .boss-panel').exists()).toBe(true);
    expect(wrapper.find('.stage-inner .character-panel').exists()).toBe(true);
  });

  it('feeds the drop-down bar the boss and the hero, parked until the stage scrolls away', () => {
    const wrapper = mountStage();
    const bar = wrapper.findComponent(BossBar);
    const boss = useBossStore().boss;
    expect(bar.props('name')).toBe(PERSONALITY_NAME[boss.personality]);
    expect(bar.props('heroLevel')).toBe(useCharacterStore().character.level);
    expect(bar.props('shown')).toBe(false);
  });
});
