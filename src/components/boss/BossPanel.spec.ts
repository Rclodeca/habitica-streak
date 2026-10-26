// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysToDayKey, createRng, dailyPeriodKey, generateBoss } from '../../game-engine';
import { useCelebration } from '../../composables/useCelebration';
import { holdHp, setHitPlayer } from '../../composables/useHitFeed';
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
    setHitPlayer(null);
    vi.useRealTimers();
  });

  it('marks a waiting skill on the stage bar without saying which', () => {
    const bossStore = useBossStore();
    bossStore.setBoss({ ...bossStore.boss, skills: [{ at: 0.5, skill: 'doom' }] });
    const wrapper = mount(BossPanel);
    expect(wrapper.findAll('.boss-block .health-bar-mark.armed')).toHaveLength(1);
    expect(wrapper.html()).not.toMatch(/doom/i);
  });

  it('marks nothing for a boss saved before skills existed', () => {
    const bossStore = useBossStore();
    const old = { ...bossStore.boss };
    delete old.skills;
    bossStore.setBoss(old);
    expect(mount(BossPanel).findAll('.health-bar-mark')).toHaveLength(0);
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

  it('turns the bosses drawn facing right to face the hero, and leaves the rest as drawn', async () => {
    const store = useBossStore();
    store.boss = { ...store.boss, personality: 'brute4x' };
    const wrapper = mount(BossPanel);
    expect(wrapper.find('.boss-figure').classes()).toContain('mirrored');

    store.boss = { ...store.boss, personality: 'warded3x' };
    await nextTick();
    expect(wrapper.find('.boss-figure').classes()).not.toContain('mirrored');
  });

  it('turns the boss in its details the same way as on the stage', async () => {
    const store = useBossStore();
    store.boss = { ...store.boss, personality: 'brute4x' };
    const wrapper = mount(BossPanel);
    await wrapper.find('button.tap-boss').trigger('click');
    expect(document.body.querySelector('.hero-sprite')!.classList).toContain('mirrored');

    store.boss = { ...store.boss, personality: 'warded3x' };
    await nextTick();
    expect(document.body.querySelector('.hero-sprite')!.classList).not.toContain('mirrored');
    wrapper.unmount();
  });

  it('shows the HP numbers inside the HP bar', () => {
    const store = useBossStore();
    store.boss = { ...store.boss, health: 474.2, maxHealth: 620 };
    const wrapper = mount(BossPanel);
    expect(wrapper.find('.boss-block .health-bar .health-bar-label').text()).toBe('474 / 620');
  });

  it("holds the bar and numbers at the boss's HP from before a blow until it lands", async () => {
    const store = useBossStore();
    store.boss = { ...store.boss, health: 378, maxHealth: 620 };
    const wrapper = mount(BossPanel);
    const release = holdHp(store.boss.index, -96);
    await nextTick();
    expect(wrapper.find('.boss-block .health-bar-label').text()).toBe('474 / 620');
    release();
    await nextTick();
    expect(wrapper.find('.boss-block .health-bar-label').text()).toBe('378 / 620');
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

  describe('active boss-skill effects', () => {
    const today = () => dailyPeriodKey(new Date());
    const tileLabels = () => Array.from(document.body.querySelectorAll('.tile-label')).map((e) => e.textContent?.trim());

    it('shows Bloodlust on the stage and in the details', async () => {
      const store = useBossStore();
      store.setBoss({ ...store.boss, bloodlustDayKey: today() });
      const wrapper = mount(BossPanel);
      expect(wrapper.find('.stat-summary .bloodlust').text()).toBe('2d');
      await wrapper.find('button.tap-boss').trigger('click');
      expect(tileLabels()).toContain('Bloodlust');
      wrapper.unmount();
    });

    it('shows Undying only on the day it fired', async () => {
      const store = useBossStore();
      store.setBoss({ ...store.boss, undyingDayKey: today() });
      const wrapper = mount(BossPanel);
      expect(wrapper.find('.stat-summary .undying').exists()).toBe(true);
      await wrapper.find('button.tap-boss').trigger('click');
      expect(tileLabels()).toContain('Undying');
      wrapper.unmount();

      store.setBoss({ ...store.boss, undyingDayKey: addDaysToDayKey(today(), -1) });
      expect(mount(BossPanel).find('.stat-summary .undying').exists()).toBe(false);
    });

    it('names a running skill in the details without explaining it', async () => {
      const store = useBossStore();
      store.setBoss({ ...store.boss, bloodlustDayKey: today(), undyingDayKey: today() });
      const wrapper = mount(BossPanel);
      await wrapper.find('button.tap-boss').trigger('click');
      const tiles = Array.from(document.body.querySelectorAll('.stat-tile')).filter((tile) => /Bloodlust|Undying/.test(tile.textContent ?? ''));
      expect(tiles).toHaveLength(2);
      for (const tile of tiles) expect(tile.querySelector('.tile-note')).toBeNull();
      wrapper.unmount();
    });

    it('shows Doom counting down', () => {
      const store = useBossStore();
      store.setBoss({ ...store.boss, doomDueDayKey: addDaysToDayKey(today(), 2) });
      expect(mount(BossPanel).find('.stat-summary .doom').text()).toBe('2d');
    });
  });
});

