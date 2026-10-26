import type { DamageType, Habit } from '../../game-engine';

// Healing first, then physical, then magic, then true damage
// — stable sort preserves each damage type's original relative order.
const DAMAGE_TYPE_ORDER: DamageType[] = ['healing', 'physical', 'magic', 'trueDamage'];
export function sortByDamageType(habits: Habit[]): Habit[] {
  return [...habits].sort(
    (a, b) => DAMAGE_TYPE_ORDER.indexOf(a.damageType) - DAMAGE_TYPE_ORDER.indexOf(b.damageType),
  );
}

// Streaks stay hidden until they reach this many.
export const MIN_STREAK_SHOWN = 3;

const STREAK_TIERS = [
  { weight: 500, size: 0.75, bright: 0 },
  { weight: 600, size: 0.82, bright: 35 },
  { weight: 700, size: 0.92, bright: 70 },
  { weight: 800, size: 1.05, bright: 100 },
];

/** The streak number's weight, size and brightness, which grow with the streak. */
export function streakStyleFor(streakCount: number) {
  const tier = STREAK_TIERS[streakCount >= 20 ? 3 : streakCount >= 10 ? 2 : streakCount >= 5 ? 1 : 0];
  return {
    fontWeight: tier.weight,
    fontSize: `${tier.size}rem`,
    color: `color-mix(in srgb, var(--text-h) ${tier.bright}%, var(--text))`,
  };
}

const RANK_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** A rank as a Roman numeral: '' for unranked, then I-VIII. */
export function rankNumeral(rank: number): string {
  return RANK_NUMERALS[rank] ?? '';
}
