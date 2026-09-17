// Wires the character/boss/habit stores together into a single debounced
// localStorage writer. Structured as a `setupPersistence(pinia)` function
// (rather than a strict Pinia `.use()` plugin) because it needs cross-store
// data — see task-5-brief.md step 2 for why this shape is acceptable.

import type { Pinia } from 'pinia';
import { useBossStore } from '../bossStore';
import { useCharacterStore } from '../characterStore';
import { useHabitStore } from '../habitStore';
import { writeSaveState } from './saveState';

const DEBOUNCE_MS = 250;

/**
 * Subscribes to all three stores and, on any mutation, debounce-writes the
 * combined save shape to localStorage. Safe to call once per `pinia`
 * instance, after the stores have been hydrated by `initFromSave`.
 */
export function setupPersistence(pinia: Pinia): void {
  const characterStore = useCharacterStore(pinia);
  const bossStore = useBossStore(pinia);
  const habitStore = useHabitStore(pinia);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const scheduleWrite = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      writeSaveState({
        character: characterStore.character,
        boss: bossStore.boss,
        habits: habitStore.habits,
        meta: { lastRolloverCheckedAt: new Date().toISOString() },
      });
    }, DEBOUNCE_MS);
  };

  // `flush: 'sync'` + `detached: true`: fire immediately on every mutation
  // (not batched onto Vue's next component-render tick) and keep the
  // subscription alive for the app's lifetime regardless of component
  // lifecycle, since this may run outside any component's `setup()`.
  const subscribeOptions = { detached: true, flush: 'sync' } as const;
  characterStore.$subscribe(scheduleWrite, subscribeOptions);
  bossStore.$subscribe(scheduleWrite, subscribeOptions);
  habitStore.$subscribe(scheduleWrite, subscribeOptions);
}
