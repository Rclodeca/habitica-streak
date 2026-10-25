// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
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
    vi.restoreAllMocks();
  });

  const mountStage = () => mount(FightStage, { global: { stubs: { teleport: true } } });

  it('holds the boss and the hero on one stage', () => {
    const wrapper = mountStage();
    expect(wrapper.find('.stage-inner .boss-panel').exists()).toBe(true);
    expect(wrapper.find('.stage-inner .character-panel').exists()).toBe(true);
  });

  it('hands the stage where its blocks end, so the tap areas can step around text that grew', async () => {
    // jsdom has no layout: place the stage and its two blocks as larger
    // system text would, the hero's block reaching up past the 212px step.
    const rects: Record<string, Partial<DOMRect>> = {
      'stage-inner': { top: 100, bottom: 400, height: 300 },
      'boss-block': { top: 110, bottom: 233, height: 123 },
      'hero-block': { top: 305, bottom: 386, height: 81 },
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const key = Object.keys(rects).find((k) => this.classList.contains(k));
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...(key ? rects[key] : {}) } as DOMRect;
    });
    const wrapper = mountStage();
    await nextTick();
    const style = wrapper.find('.stage-inner').attributes('style');
    expect(style).toContain('--boss-bottom: 133px');
    expect(style).toContain('--hero-top: 205px');
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
