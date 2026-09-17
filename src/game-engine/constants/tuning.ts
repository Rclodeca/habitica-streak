export const TUNING = {
  // Scaled up ~30x from the original 10/10/6/50 (see PROGRESS.md "Balance
  // rescale") so that a 1% streak/item bonus moves the displayed (rounded)
  // damage number by more than a rounding error, and so one day of fully
  // completing physical+magic habits can actually kill boss 1.
  BASE_STATS: { physicalDamage: 800, magicDamage: 800, healing: 480, health: 1250 },
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level
  STREAK_MULTIPLIER_PER_COUNT: 0.01, // +1% damage per streak count
  BASE_BOSS_POWER: 2500, // boss 1 (balanced) health = 2500 * BOSS_STAT_SHARE.health = 1000
  BOSS_GROWTH_RATE: 1.22, // boss power ×1.22 per boss index
  BOSS_STAT_SHARE: { health: 0.4, physicalAttack: 0.2, magicAttack: 0.2, armor: 0.1, magicResist: 0.1 }, // sums to 1
  PERSONALITY_EMPHASIS_FACTOR: 2.0,
  RESIST_K: 1500, // scaled with BASE_BOSS_POWER so early-game resist % is unchanged (~14% at boss 1)
  BASE_BOSS_EXP: 40, // deliberately NOT rescaled — EXP/leveling pace is a separate economy, untouched by this balance pass
  BOSS_EXP_GROWTH_RATE: 1.18,
  MISS_DAMAGE_FACTOR: 0.5,
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.4, magic: 0.4, healing: 0.2 },
  BOSS_PERSONALITY_WEIGHTS: { balanced: 0.2, tank: 0.2, armored: 0.2, warded: 0.2, brute: 0.2 },
  ITEM_DROP_EVERY_N_BOSSES: 3, // bosses 1-3 drop 1 item, 4-6 drop 2, 7+ drop 3 (capped)
  ITEM_DROP_MAX_COUNT: 3,
} as const;
