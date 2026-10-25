// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveStat, ITEM_CATALOG } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import Modal from '../ui/Modal.vue';
import CharacterPanel from './CharacterPanel.vue';

enableAutoUnmount(afterEach);

describe('CharacterPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // jsdom has no ResizeObserver; the stat line watches its own size.
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

  // The hero art follows the run's rolled physical/magic split (heroClassFor).
  function setClass(physical: number, magic: number) {
    const { starterStats } = useCharacterStore().character;
    starterStats.physicalDamage = physical;
    starterStats.magicDamage = magic;
  }

  it('has no equipped-items grid, but keeps the gear in the details', async () => {
    const store = useCharacterStore();
    const item = ITEM_CATALOG[0];
    store.character.ownedItemIds = [item.id];
    store.character.equippedItemIds = [item.id];
    const wrapper = mount(CharacterPanel);
    expect(wrapper.find('.item-grid').exists()).toBe(false);
    await wrapper.find('button.tap-hero').trigger('click');
    expect(wrapper.findComponent(Modal).props('modelValue')).toBe(true);
  });

  it('keeps the level outside the part of the name that gets cut', () => {
    useCharacterStore().character.name = 'Bartholomew Long';
    const wrapper = mount(CharacterPanel);
    expect(wrapper.find('.name-line .hero-name').text()).toBe('Bartholomew Long');
    expect(wrapper.find('.name-line > .level-number').text()).toBe(String(useCharacterStore().character.level));
  });

  it('shows the HP numbers under the HP bar', () => {
    const store = useCharacterStore();
    store.character.currentHealth = 980.4;
    const wrapper = mount(CharacterPanel);
    const block = wrapper.find('.hero-block').element;
    const kids = Array.from(block.children);
    const numbers = block.querySelector('.hp-numbers')!;
    expect(numbers.textContent).toBe(`980 / ${Math.round(effectiveStat(store.character, 'health'))}`);
    expect(kids.indexOf(numbers)).toBe(kids.indexOf(block.querySelector('.health-bar')!) + 1);
  });

  it('turns the warrior and cleric to face the boss and places each by its class', async () => {
    setClass(600, 300);
    const wrapper = mount(CharacterPanel);
    expect(wrapper.find('.hero-figure').classes()).toContain('mirrored');
    setClass(300, 600);
    await nextTick();
    expect(wrapper.find('.hero-figure').attributes('style')).toContain('--hero-w: 174');
    setClass(450, 450);
    await nextTick();
    expect(wrapper.find('.hero-figure').classes()).not.toContain('mirrored');
  });
});
