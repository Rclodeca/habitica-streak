// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (characterStore.spec.ts, useCombatActions.spec.ts).

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Quest } from '../game-engine';
import { useQuestStore } from './questStore';

describe('questStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts empty', () => {
    const store = useQuestStore();
    expect(store.quests).toEqual([]);
  });

  it('initFromSave hydrates from a saved list', () => {
    const store = useQuestStore();
    const saved: Quest[] = [{ id: 'q1', kind: 'side', description: 'Test', difficulty: 'easy', dueDateKey: '2026-01-01', rewardItemId: 'dragons-heart' }];
    store.initFromSave(saved);
    expect(store.quests).toEqual(saved);
  });

  it('initFromSave migrates a pre-v2 quest to a regular quest without bossIndexAtOffer', () => {
    const store = useQuestStore();
    store.initFromSave([{ id: 'q1', description: 'Old', difficulty: 'easy', dueDateKey: '2026-01-01', bossIndexAtOffer: 3 } as unknown as Quest]);
    expect(store.quests).toEqual([{ id: 'q1', kind: 'regular', description: 'Old', difficulty: 'easy', dueDateKey: '2026-01-01' }]);
  });

  it('initFromSave stays empty when given null (old save with no quests field)', () => {
    const store = useQuestStore();
    store.initFromSave(null);
    expect(store.quests).toEqual([]);
  });

  it('addQuest creates and appends a quest via the engine', () => {
    const store = useQuestStore();
    const quest = store.addQuest('Clean garage', 'hard', '2026-02-01');
    expect(store.quests).toEqual([quest]);
    expect(quest).toMatchObject({ kind: 'regular', description: 'Clean garage', difficulty: 'hard', dueDateKey: '2026-02-01' });
  });

  it('addQuest can create a side quest with a reward item', () => {
    const store = useQuestStore();
    const quest = store.addQuest('Slay it', 'medium', '2026-02-01', 'side', 'dragons-heart');
    expect(quest).toMatchObject({ kind: 'side', rewardItemId: 'dragons-heart' });
  });

  it('removeQuest removes by id and leaves others untouched', () => {
    const store = useQuestStore();
    const a = store.addQuest('A', 'easy', '2026-01-01');
    const b = store.addQuest('B', 'easy', '2026-01-01');
    store.removeQuest(a.id);
    expect(store.quests).toEqual([b]);
  });
});
