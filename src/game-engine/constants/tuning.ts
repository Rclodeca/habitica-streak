export const TUNING = {
  BASE_STATS: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level
  STREAK_MULTIPLIER_PER_COUNT: 0.01, // +1% damage per streak count
  BASE_BOSS_POWER: 80,
  BOSS_GROWTH_RATE: 1.22, // boss power ×1.22 per boss index
  BOSS_STAT_SHARE: { health: 0.4, physicalAttack: 0.2, magicAttack: 0.2, armor: 0.1, magicResist: 0.1 }, // sums to 1
  PERSONALITY_EMPHASIS_FACTOR: 2.0,
  RESIST_K: 50, // diminishing-returns constant
  BASE_BOSS_EXP: 40,
  BOSS_EXP_GROWTH_RATE: 1.18,
  MISS_DAMAGE_FACTOR: 0.5,
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.4, magic: 0.4, healing: 0.2 },
  BOSS_PERSONALITY_WEIGHTS: { balanced: 0.2, tank: 0.2, armored: 0.2, warded: 0.2, brute: 0.2 },
  ITEM_DROP_EVERY_N_BOSSES: 3, // bosses 1-3 drop 1 item, 4-6 drop 2, 7+ drop 3 (capped)
  ITEM_DROP_MAX_COUNT: 3,
} as const;
