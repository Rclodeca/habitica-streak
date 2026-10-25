// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng, generateBoss } from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { useBossStore } from '../../store/bossStore';
import Modal from '../ui/Modal.vue';
import BossPanel from './BossPanel.vue';

enableAutoUnmount(afterEach);

describe('BossPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  // useCelebration is a module-scope singleton — reset it between tests.
  afterEach(() => {
    useCelebration().clear();
    vi.useRealTimers();
  });

  it('opens the boss details from its tap area', async () => {
    const wrapper = mount(BossPanel);
    await wrapper.find('button.tap-boss').trigger('click');
    expect(wrapper.findComponent(Modal).props('modelValue')).toBe(true);
  });

  it('lights the boss while its tap area is held', async () => {
    const wrapper = mount(BossPanel);
    await wrapper.find('.tap-boss').trigger('pointerdown');
    expect(wrapper.find('.boss-panel').classes()).toContain('pressed');
    await wrapper.find('.tap-boss').trigger('pointerup');
    expect(wrapper.find('.boss-panel').classes()).not.toContain('pressed');
  });

  it('keeps the chevron with the last word of the boss name, so it never wraps alone', () => {
    const store = useBossStore();
    store.boss = { ...store.boss, personality: 'warded5x' };
    const wrapper = mount(BossPanel);
    expect(wrapper.find('.boss-name').text()).toBe('Ethereal Sovereign');
    expect(wrapper.find('.boss-name > .name-tail').text()).toBe('Sovereign');
  });

  it('shows the HP numbers under the HP bar', () => {
    const store = useBossStore();
    store.boss = { ...store.boss, health: 474.2, maxHealth: 620 };
    const wrapper = mount(BossPanel);
    const block = wrapper.find('.boss-block').element;
    const kids = Array.from(block.children);
    const numbers = block.querySelector('.hp-numbers')!;
    expect(numbers.textContent).toBe('474 / 620');
    expect(kids.indexOf(numbers)).toBe(kids.indexOf(block.querySelector('.health-bar')!) + 1);
  });

  it('lets the boss fall and stamps "Slain" on the stage', async () => {
    const rng = createRng(7);
    const wrapper = mount(BossPanel);
    useCelebration().celebrateBossKill({ ...generateBoss(1, rng), health: 0 }, generateBoss(2, rng));
    vi.runOnlyPendingTimers();
    await nextTick();
    expect(wrapper.find('.boss-figure').classes()).toContain('dying');
    expect(wrapper.find('.slain-stamp').exists()).toBe(true);
  });
});
