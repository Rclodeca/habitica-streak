// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import HealthBar from './HealthBar.vue';

enableAutoUnmount(afterEach);

describe('HealthBar — breakpoint marks', () => {
  it('draws each mark at its breakpoint, in its state', () => {
    const wrapper = mount(HealthBar, {
      props: { current: 80, max: 100, variant: 'boss', marks: [{ at: 0.75, state: 'armed' }, { at: 0.25, state: 'spent' }] },
    });
    const marks = wrapper.findAll('.health-bar-mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].attributes('style')).toContain('left: 75%');
    expect(marks[0].classes()).toContain('armed');
    expect(marks[1].attributes('style')).toContain('left: 25%');
    expect(marks[1].classes()).toContain('spent');
    expect(marks[0].attributes('aria-hidden')).toBe('true');
  });

  it('draws no marks by default', () => {
    expect(mount(HealthBar, { props: { current: 80, max: 100 } }).findAll('.health-bar-mark')).toHaveLength(0);
  });
});
