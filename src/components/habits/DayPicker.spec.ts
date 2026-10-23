// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DayPicker from './DayPicker.vue';

describe('DayPicker', () => {
  it('tapping a lit day emits the rest, sorted', async () => {
    const w = mount(DayPicker, { props: { modelValue: [0, 2, 5] } });
    await w.findAll('button.day')[2].trigger('click');
    expect(w.emitted('update:modelValue')?.[0]).toEqual([[0, 5]]);
  });

  it('tapping an unlit day adds it', async () => {
    const w = mount(DayPicker, { props: { modelValue: [5, 0] } });
    await w.findAll('button.day')[1].trigger('click');
    expect(w.emitted('update:modelValue')?.[0]).toEqual([[0, 1, 5]]);
  });

  it('the last lit day cannot be turned off', async () => {
    const w = mount(DayPicker, { props: { modelValue: [3] } });
    await w.findAll('button.day')[3].trigger('click');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});
