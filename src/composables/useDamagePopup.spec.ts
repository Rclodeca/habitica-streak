import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDamagePopup } from './useDamagePopup';

describe('useDamagePopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags a hit and adds a popup when health decreases', async () => {
    const health = ref(100);
    const { popups, isHit } = useDamagePopup(() => health.value);

    health.value = 85;
    await nextTick();

    expect(isHit.value).toBe(true);
    expect(popups.value).toEqual([{ id: expect.any(Number), amount: 15 }]);

    vi.advanceTimersByTime(300);
    expect(isHit.value).toBe(false);

    vi.advanceTimersByTime(600);
    expect(popups.value).toEqual([]);
  });

  it('does nothing when health increases (e.g. healing)', async () => {
    const health = ref(50);
    const { popups, isHit } = useDamagePopup(() => health.value);

    health.value = 70;
    await nextTick();

    expect(isHit.value).toBe(false);
    expect(popups.value).toEqual([]);
  });

  it('tracks multiple concurrent popups independently', async () => {
    const health = ref(100);
    const { popups } = useDamagePopup(() => health.value);

    health.value = 90;
    await nextTick();
    expect(popups.value.length).toBe(1);

    vi.advanceTimersByTime(400);
    health.value = 75;
    await nextTick();
    expect(popups.value.length).toBe(2);

    vi.advanceTimersByTime(500); // first popup (900ms lifetime) expires, second doesn't yet
    expect(popups.value).toEqual([{ id: expect.any(Number), amount: 15 }]);
  });
});
