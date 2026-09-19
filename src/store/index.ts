// Entry point for the Pinia layer: creates the Pinia instance, and exposes
// `initializeStores()` to hydrate all four stores from a save (or bootstrap
// fresh) and wire up debounced localStorage persistence.

import { createPinia, getActivePinia, setActivePinia, type Pinia } from 'pinia';
import { createRng } from '../game-engine';
import { useActivityLogStore } from './activityLogStore';
import { useBossStore } from './bossStore';
import { useCharacterStore } from './characterStore';
import { useHabitStore } from './habitStore';
import { setupHighScoreTracking } from './plugins/highScoreTracking';
import { setupPersistence } from './plugins/localStoragePersistence';
import { loadSaveState } from './plugins/saveState';

export const pinia = createPinia();

/**
 * Loads any existing save (starting fresh on a schema mismatch or no save),
 * hydrates all four stores from it using a single shared `Rng` for this
 * session, and registers the debounced persistence subscriptions.
 *
 * Defaults to whichever Pinia instance is currently active (e.g. one a test
 * set up via `setActivePinia(createPinia())` before calling this), falling
 * back to this module's own `pinia` singleton only if none is active — so
 * this never silently overrides a caller's own active instance.
 */
export function initializeStores(targetPinia: Pinia = getActivePinia() ?? pinia) {
  setActivePinia(targetPinia);

  const saved = loadSaveState();
  const rng = createRng();

  const characterStore = useCharacterStore(targetPinia);
  const bossStore = useBossStore(targetPinia);
  const habitStore = useHabitStore(targetPinia);
  const activityLogStore = useActivityLogStore(targetPinia);

  characterStore.initFromSave(saved?.character ?? null, rng);
  bossStore.initFromSave(saved?.boss ?? null, rng);
  habitStore.initFromSave(saved?.habits ?? null);
  activityLogStore.initFromSave(saved?.activityLog ?? null);

  setupPersistence(targetPinia);
  setupHighScoreTracking(targetPinia);

  return { characterStore, bossStore, habitStore, activityLogStore };
}

export { useActivityLogStore, useBossStore, useCharacterStore, useHabitStore };
export { useHighScoreStore } from './highScoreStore';
