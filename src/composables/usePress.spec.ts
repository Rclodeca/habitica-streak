import { describe, expect, it } from 'vitest';
import { usePress } from './usePress';

describe('usePress', () => {
  it('presses on pointerdown and lets go on pointerup', () => {
    const { pressed, pressHandlers } = usePress();
    pressHandlers.pointerdown();
    expect(pressed.value).toBe(true);
    pressHandlers.pointerup();
    expect(pressed.value).toBe(false);
  });

  it('lets go when the press turns into a scroll or slides off', () => {
    const { pressed, pressHandlers } = usePress();
    pressHandlers.pointerdown();
    pressHandlers.pointercancel();
    expect(pressed.value).toBe(false);
    pressHandlers.pointerdown();
    pressHandlers.pointerleave();
    expect(pressed.value).toBe(false);
  });
});
