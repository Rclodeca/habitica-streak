import { afterEach, describe, expect, it } from 'vitest';
import { useDeathScreen } from './useDeathScreen';

describe('useDeathScreen', () => {
  // `isDead` is a module-scope singleton, shared across every call to
  // useDeathScreen() (by design — see the composable's comment) — so it
  // also persists across `it()` blocks in this file. Reset it after each.
  afterEach(() => {
    useDeathScreen().dismiss();
  });

  it('starts false', () => {
    const { isDead } = useDeathScreen();
    expect(isDead.value).toBe(false);
  });

  it('triggerDeath sets isDead true', () => {
    const { isDead, triggerDeath } = useDeathScreen();
    triggerDeath();
    expect(isDead.value).toBe(true);
  });

  it('dismiss sets isDead back to false', () => {
    const { isDead, triggerDeath, dismiss } = useDeathScreen();
    triggerDeath();
    dismiss();
    expect(isDead.value).toBe(false);
  });

  it('is shared across separate calls to useDeathScreen()', () => {
    const first = useDeathScreen();
    const second = useDeathScreen();
    first.triggerDeath();
    expect(second.isDead.value).toBe(true);
  });
});
