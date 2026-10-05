// Records the boss index every time it changes, so a run's peak survives a
// death/reset (which puts boss.index back to 1 — recordBossIndex only ever
// moves the record up, never down). Also stamps the in-progress run's start
// day the first time this ever runs for a save (see
// highScoreStore.ensureRunStarted) — a later death's `recordRunEnd` reads
// that value to compute `daysLived`. Idempotent per `pinia` instance, same
// pattern as `setupPersistence`.

import type { Pinia } from 'pinia';
import { useBossStore } from '../bossStore';
import { useHighScoreStore } from '../highScoreStore';

const wiredPinias = new WeakSet<Pinia>();

export function setupHighScoreTracking(pinia: Pinia, currentDayKey: string): void {
  if (wiredPinias.has(pinia)) return;
  wiredPinias.add(pinia);

  const bossStore = useBossStore(pinia);
  const highScoreStore = useHighScoreStore(pinia);

  highScoreStore.recordBossIndex(bossStore.boss.index);
  highScoreStore.ensureRunStarted(currentDayKey);
  bossStore.$subscribe((_mutation, state) => {
    highScoreStore.recordBossIndex(state.boss.index);
  }, { detached: true });
}
