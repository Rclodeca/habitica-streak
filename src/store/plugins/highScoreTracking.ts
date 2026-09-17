// Records the boss index every time it changes, so a run's peak survives a
// death/reset (which puts boss.index back to 1 — recordBossIndex only ever
// moves the record up, never down). Idempotent per `pinia` instance, same
// pattern as `setupPersistence`.

import type { Pinia } from 'pinia';
import { useBossStore } from '../bossStore';
import { useHighScoreStore } from '../highScoreStore';

const wiredPinias = new WeakSet<Pinia>();

export function setupHighScoreTracking(pinia: Pinia): void {
  if (wiredPinias.has(pinia)) return;
  wiredPinias.add(pinia);

  const bossStore = useBossStore(pinia);
  const highScoreStore = useHighScoreStore(pinia);

  highScoreStore.recordBossIndex(bossStore.boss.index);
  bossStore.$subscribe((_mutation, state) => {
    highScoreStore.recordBossIndex(state.boss.index);
  }, { detached: true });
}
