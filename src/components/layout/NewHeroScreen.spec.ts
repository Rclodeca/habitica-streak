// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCharacter, createRng, heroClassFor } from '../../game-engine';
import type { HeroClass } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import NewHeroScreen from './NewHeroScreen.vue';

enableAutoUnmount(afterEach);

describe('NewHeroScreen', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountAs(heroClass: HeroClass, overrides: { heroPending?: boolean } = {}) {
    useCharacterStore().character = { ...createCharacter(createRng(3), heroClass), ...overrides };
    return mount(NewHeroScreen, { global: { plugins: [pinia] } });
  }

  const label = (wrapper: ReturnType<typeof mountAs>) => wrapper.find('.pick-name').text();

  it('opens on the hero the run was rolled as', () => {
    expect(label(mountAs('ranger'))).toBe('Ranger');
  });

  it('turns through Warrior, Mage, Ranger and Fate, wrapping both ways', async () => {
    const wrapper = mountAs('warrior');
    const seen = [label(wrapper)];
    for (let i = 0; i < 4; i++) {
      await wrapper.find('.turn-next').trigger('click');
      seen.push(label(wrapper));
    }
    expect(seen).toEqual(['Warrior', 'Mage', 'Ranger', 'Fate', 'Warrior']);
    await wrapper.find('.turn-prev').trigger('click');
    expect(label(wrapper)).toBe('Fate');
  });

  it('turns on a sideways swipe', async () => {
    const wrapper = mountAs('warrior');
    const stage = wrapper.find('.hero-pick');
    await stage.trigger('pointerdown', { clientX: 200 });
    await stage.trigger('pointerup', { clientX: 120 });
    expect(label(wrapper)).toBe('Mage');
    await stage.trigger('pointerdown', { clientX: 120 });
    await stage.trigger('pointerup', { clientX: 200 });
    expect(label(wrapper)).toBe('Warrior');
  });

  it('begins the run as the hero shown', async () => {
    const wrapper = mountAs('warrior');
    await wrapper.find('.turn-next').trigger('click');
    await wrapper.find('.name-input').setValue('Brand');
    await wrapper.find('form').trigger('submit');

    const { character } = useCharacterStore();
    expect(character.name).toBe('Brand');
    expect(heroClassFor(character)).toBe('cleric');
  });

  it('offers no pick to a run already under way (a save from before it)', () => {
    const wrapper = mountAs('warrior', { heroPending: undefined });
    expect(wrapper.find('.hero-pick').exists()).toBe(false);
    expect(wrapper.find('.player-sprite').exists()).toBe(true);
  });
});
