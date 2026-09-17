import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLootToast } from './useLootToast';

describe('useLootToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds one toast per item name', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot(['Steel Sword', 'Lucky Coin']);

    expect(toasts.value.length).toBe(before + 2);
    expect(toasts.value.at(-2)?.message).toBe('Found: Steel Sword!');
    expect(toasts.value.at(-1)?.message).toBe('Found: Lucky Coin!');
  });

  it('auto-removes a toast after its lifetime', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot(['Rusty Blade']);
    expect(toasts.value.length).toBe(before + 1);

    vi.advanceTimersByTime(3000);
    expect(toasts.value.length).toBe(before);
  });

  it('does nothing for an empty list', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot([]);

    expect(toasts.value.length).toBe(before);
  });
});
