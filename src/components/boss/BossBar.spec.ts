// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import BossBar from './BossBar.vue';

enableAutoUnmount(afterEach);

describe('BossBar', () => {
  const props = {
    sprite: 'bosses/brute3x',
    name: 'Raging Berserker',
    current: 431.4,
    max: 604.3,
    heroClass: 'warrior' as const,
    heroCurrent: 980,
    heroMax: 1232,
    heroLevel: 4,
    shown: false,
  };

  it('mirrors breakpoint marks, since its bar drains toward the portrait on the right', () => {
    const wrapper = mount(BossBar, { props: { ...props, marks: [{ at: 0.75, state: 'armed' as const }] } });
    expect(wrapper.find('.health-bar-mark').attributes('style')).toContain('left: 25%');
  });

  it('shows the boss name and its rounded HP numbers', () => {
    const wrapper = mount(BossBar, { props });
    expect(wrapper.find('.name').text()).toBe('Raging Berserker');
    expect(wrapper.find('.numbers').text()).toBe('431 / 604');
  });

  it('stays parked and inert until shown', async () => {
    const wrapper = mount(BossBar, { props });
    expect(wrapper.classes()).not.toContain('shown');
    expect(wrapper.attributes('inert')).toBeDefined();

    await wrapper.setProps({ shown: true });
    expect(wrapper.classes()).toContain('shown');
    expect(wrapper.attributes('inert')).toBeUndefined();
  });

  it('is plain status, not a button', async () => {
    const wrapper = mount(BossBar, { props: { ...props, shown: true } });
    expect(wrapper.element.tagName).toBe('DIV');
    await wrapper.trigger('click');
    expect(wrapper.emitted('open')).toBeUndefined();
  });

  it("turns the boss's portrait when its art faces away from the hero", async () => {
    const wrapper = mount(BossBar, { props });
    expect(wrapper.find('.portrait').classes()).not.toContain('mirrored');

    await wrapper.setProps({ spriteMirrored: true });
    expect(wrapper.find('.portrait').classes()).toContain('mirrored');
  });

  it('pops each hit the boss takes', async () => {
    const wrapper = mount(BossBar, { props: { ...props, shown: true } });
    await wrapper.setProps({ current: 331.4 });
    expect(wrapper.find('.hit-layer .damage-popup').text()).toBe('-100');
  });

  it("shows the hero's level on the ring", () => {
    const wrapper = mount(BossBar, { props });
    expect(wrapper.find('.ring .level').text()).toBe('4');
  });

  it("draws the ring's arc as the share of hero HP left", async () => {
    const wrapper = mount(BossBar, { props });
    const offset = () => Number(wrapper.find('.ring .arc').attributes('stroke-dashoffset'));
    const length = Number(wrapper.find('.ring .arc').attributes('stroke-dasharray'));
    expect(offset()).toBeCloseTo(length * (1 - 980 / 1232));

    await wrapper.setProps({ heroCurrent: 1232 });
    expect(offset()).toBeCloseTo(0);
  });

  it('warns once the hero drops below a quarter of their HP', async () => {
    const wrapper = mount(BossBar, { props: { ...props, heroCurrent: 308 } });
    expect(wrapper.find('.ring').classes()).not.toContain('low');

    await wrapper.setProps({ heroCurrent: 307 });
    expect(wrapper.find('.ring').classes()).toContain('low');
  });

  it('pops each hit the hero takes on the ring', async () => {
    const wrapper = mount(BossBar, { props: { ...props, shown: true } });
    await wrapper.setProps({ heroCurrent: 917 });
    expect(wrapper.find('.ring .damage-popup').text()).toBe('-63');
    expect(wrapper.find('.hit-layer .damage-popup').exists()).toBe(false);
  });

  it('turns the warrior and cleric to face the boss, and leaves the ranger as drawn', async () => {
    const wrapper = mount(BossBar, { props });
    expect(wrapper.find('.ring-face').classes()).toContain('mirrored');

    await wrapper.setProps({ heroClass: 'cleric' });
    expect(wrapper.find('.ring-face').classes()).toContain('mirrored');

    await wrapper.setProps({ heroClass: 'ranger' });
    expect(wrapper.find('.ring-face').classes()).not.toContain('mirrored');
  });
});
