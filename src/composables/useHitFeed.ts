// Small shared (module-scope) channel for hits — same singleton reasoning as
// useCelebration: the code that resolves a blow (useCombatActions) and the
// stage that plays it (FightStage) must see the same state.
//
// The stores change the instant a blow resolves, but on the stage a bolt can
// take half a second to arrive. So the stage holds each fighter's shown HP
// back by the blow's change until that part of it lands (`hpLag`), and the
// bars drop with the hit, not the tap. Purely presentational: no game state
// waits on it, and with no stage showing (no player set) nothing is held.

import { reactive } from 'vue';

export type Fighter = 'hero' | 'boss';
export type StrikeType = 'physical' | 'magic' | 'trueDamage';

/** What a follow-up did: the number to show, and the change it made to an HP bar. */
export interface HitPart {
  amount: number;
  hp: number;
}

/**
 * One blow, as the stage plays it. `hp` is the change it made to its
 * target's HP (signed, as the store has it). Lifesteal heals the attacker;
 * reflect turns part of the hero's blow back on the hero.
 */
export type Hit =
  | {
      kind: 'strike';
      by: Fighter;
      type: StrikeType;
      amount: number;
      crit: boolean;
      hp: number;
      bossIndex: number;
      lifesteal?: HitPart;
      reflect?: HitPart;
    }
  | { kind: 'heal'; amount: number; hp: number }
  // No attacker (a missed quest): just the hurt and its number.
  | { kind: 'hurt'; amount: number; hp: number };

/** Plays a hit and returns how long until its main blow lands, in ms. */
export type HitPlayer = (hit: Hit) => number;

/** Keyed 'hero' or by boss index, so a hit queued on the next boss never shows on the slain one. */
export type HpKey = 'hero' | number;

const hpLag = reactive<Record<string, number>>({});
let player: HitPlayer | null = null;
// Bumped on every reset, so a release from before it can't skew the new count.
let generation = 0;

/**
 * Holds `change` off the shown HP for `key` until the returned release runs.
 * Releasing twice, or after a reset, does nothing.
 */
export function holdHp(key: HpKey, change: number): () => void {
  if (change === 0) return () => {};
  const k = String(key);
  hpLag[k] = (hpLag[k] ?? 0) - change;
  const held = generation;
  let released = false;
  return () => {
    if (released || held !== generation) return;
    released = true;
    hpLag[k] = (hpLag[k] ?? 0) + change;
  };
}

/** The stage plays hits from now on (or stops, with null; anything held is let go). */
export function setHitPlayer(next: HitPlayer | null) {
  player = next;
  if (next) return;
  generation++;
  for (const k of Object.keys(hpLag)) delete hpLag[k];
}

/** Sends a hit to the stage; returns how long until it lands (0 with no stage). */
export function playHit(hit: Hit): number {
  return player?.(hit) ?? 0;
}

export function useHitFeed() {
  /** `health` as the stage should show it for `key`, kept within 0..`max`. */
  function shownHp(key: HpKey, health: number, max: number): number {
    return Math.max(0, Math.min(max, health + (hpLag[String(key)] ?? 0)));
  }

  return { shownHp };
}
