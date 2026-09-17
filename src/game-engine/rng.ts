export type Rng = () => number;

/**
 * mulberry32 — a small, fast, deterministic 32-bit PRNG.
 * Given the same seed, produces the same sequence of outputs every time.
 * Returns floats in [0, 1).
 */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a deterministic RNG when a numeric seed is given, or falls back
 * to wrapping `Math.random` when no seed is given.
 */
export function createRng(seed?: number): Rng {
  if (typeof seed === 'number') {
    return mulberry32(seed);
  }
  return () => Math.random();
}

/**
 * Picks a key from a weights map proportional to its weight. Weights are
 * normalized internally, so callers don't need to pre-sum them to 1.
 */
export function pickWeighted<T extends string>(weights: Record<string, number>, rng: Rng): T {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      return key as T;
    }
  }
  // Fallback for floating-point edge cases: return the last key.
  return entries[entries.length - 1][0] as T;
}

/** Fisher-Yates shuffle. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
