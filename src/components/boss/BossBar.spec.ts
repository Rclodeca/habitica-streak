// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import BossBar from './BossBar.vue';

enableAutoUnmount(afterEach);

describe('BossBar', () => {
  const props = { sprite: 'bosses/brute3x', name: 'Raging Berserker', current: 431.4, max: 604.3, shown: false };

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

  it('asks for the boss details when tapped', async () => {
    const wrapper = mount(BossBar, { props: { ...props, shown: true } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(1);
  });

  it('pops each hit the boss takes', async () => {
    const wrapper = mount(BossBar, { props: { ...props, shown: true } });
    await wrapper.setProps({ current: 331.4 });
    expect(wrapper.find('.damage-popup').text()).toBe('-100');
  });
});
