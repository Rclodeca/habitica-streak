// Small shared (module-scope) queue for the boss-kill and level-up beats —
// same singleton reasoning as useItemDropQueue: the code that detects a kill
// or a level-up (useCombatActions) and the panels that play it out
// (BossPanel/BossBar, CharacterPanel) must see the same state.
//
// The stores change the instant a kill lands, so on their own the slain boss
// would just be swapped for the next one before anything could show it
// dying. Each beat instead holds what the panels should draw while it plays:
// the slain boss (at 0 HP) is struck and falls, the next one rises, then the
// hero's level ticks over. Purely presentational — no game state waits on
// it — but the item-drop, quest-unlock and level-up pick popups do (see
// ItemDropPopup/useModalPriority), so they open after the scene, not over it.
//
// Every queued kill plays before the level-up, whatever order they arrived
// in: a kill's level-up should follow the kill even when a streak
// milestone's EXP leveled the hero first in the same tap.

import { computed, ref } from 'vue';
import type { Boss } from '../game-engine';

export type CelebrationPhase = 'idle' | 'struck' | 'dying' | 'arriving' | 'leveling';

interface BossBeat {
  slain: Boss;
  next: Boss;
  // When the killing blow lands on the stage (a bolt is still in flight
  // when the kill resolves), so 'struck' waits for it.
  landsAt: number;
}

// 'struck' lets the killing blow's hit land before the fall starts.
const PHASE_MS = { struck: 450, dying: 2150, arriving: 800, leveling: 1400 };
// Nothing moves under reduced motion, but "Slain" still holds long enough to read.
const REDUCED_PHASE_MS = { struck: 0, dying: 1200, arriving: 0, leveling: 600 };

const bossBeats = ref<BossBeat[]>([]);
const playing = ref<BossBeat | null>(null);
const phase = ref<CelebrationPhase>('idle');
// The level the hero panel keeps showing until the level beat plays: the
// lowest one since the last beat, so back-to-back level-ups play as one.
const heldLevel = ref<number | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

function phaseMs(name: Exclude<CelebrationPhase, 'idle'>): number {
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (reduced ? REDUCED_PHASE_MS : PHASE_MS)[name];
}

function enter(name: Exclude<CelebrationPhase, 'idle'>, then: () => void, extraMs = 0) {
  phase.value = name;
  timer = setTimeout(then, phaseMs(name) + extraMs);
}

function playNext() {
  const beat = bossBeats.value.shift();
  if (beat) {
    playing.value = beat;
    const untilLanded = Math.max(0, beat.landsAt - Date.now());
    enter('struck', () => enter('dying', () => enter('arriving', playNext)), untilLanded);
    return;
  }
  playing.value = null;
  if (heldLevel.value !== null) {
    heldLevel.value = null;
    enter('leveling', playNext);
    return;
  }
  phase.value = 'idle';
}

export function useCelebration() {
  /** The boss the panels should draw instead of the store's, or null to draw the store's. */
  const displayedBoss = computed<Boss | null>(() => {
    if (!playing.value) return null;
    return phase.value === 'arriving' ? playing.value.next : playing.value.slain;
  });

  const celebrating = computed(() => phase.value !== 'idle' || bossBeats.value.length > 0 || heldLevel.value !== null);

  /**
   * Starts at once: the panels must swap to `slain` in the same render the
   * store swaps to the next boss, or the killing blow never shows.
   * `landsInMs` is how long until that blow lands on the stage (playHit's
   * answer); the fall waits for it.
   */
  function celebrateBossKill(slain: Boss, next: Boss, landsInMs = 0) {
    bossBeats.value.push({ slain, next, landsAt: Date.now() + landsInMs });
    if (phase.value === 'idle') playNext();
  }

  /**
   * Holds `fromLevel` on the hero panel right away, but waits a microtask to
   * start, so a kill resolved later in the same action still plays first.
   */
  function celebrateLevelUp(fromLevel: number) {
    if (heldLevel.value === null || fromLevel < heldLevel.value) heldLevel.value = fromLevel;
    queueMicrotask(() => {
      if (phase.value === 'idle') playNext();
    });
  }

  function clear() {
    clearTimeout(timer);
    bossBeats.value = [];
    playing.value = null;
    heldLevel.value = null;
    phase.value = 'idle';
  }

  return { phase, displayedBoss, heldLevel, celebrating, celebrateBossKill, celebrateLevelUp, clear };
}
