// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '../store/characterStore';
import { useSlotUnlockNotice } from './useSlotUnlockNotice';

describe('useSlotUnlockNotice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('is not pending below level 10', () => {
    expect(useSlotUnlockNotice().isPending.value).toBe(false);
  });

  it('is pending at level 10 until dismissed, then stays dismissed', () => {
    const characterStore = useCharacterStore();
    characterStore.setCharacter({ ...characterStore.character, level: 10 });
    const { isPending, dismiss } = useSlotUnlockNotice();
    expect(isPending.value).toBe(true);
    dismiss();
    expect(isPending.value).toBe(false);
    expect(localStorage.getItem('habitica-streak:slot-unlock-notice-seen:v1')).toBe('1');
  });
});
