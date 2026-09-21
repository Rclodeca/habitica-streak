export const TUNING = {
  // Scaled up ~30x from the original 10/10/6/50 (see PROGRESS.md "Balance
  // rescale") so that a 1% streak/item bonus moves the displayed (rounded)
  // damage number by more than a rounding error, and so one day of fully
  // completing physical+magic habits can actually kill boss 1.
  BASE_STATS: { physicalDamage: 800, magicDamage: 800, healing: 480, health: 1250 },
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level
  // Bumped from 0.01 (+1%/streak) to 0.10 (+10%/streak) so a well-kept
  // streak actually keeps pace with the exponential boss curve below —
  // streak 10 -> 2x, streak 30 -> 4x, streak 100 -> 11x damage.
  STREAK_MULTIPLIER_PER_COUNT: 0.10,
  // Weeklies take much longer to stack a streak (once/week vs. every day),
  // so each streak count is worth 3x as much as a daily's.
  WEEKLY_STREAK_MULTIPLIER_PER_COUNT: 0.30,
  // Lowered 2650 -> 1800 and BOSS_GROWTH_RATE 1.30 -> 1.16 below, alongside
  // retaining habit streaks across death (see resolvePlayerDeathIfDead) and
  // MISS_DAMAGE_FACTOR below, as a coordinated pacing pass — tuned via a
  // throwaway per-life simulation (spawn-to-death, not a fixed day window)
  // across bad/balanced/good/chaotic completion-rate archetypes, targeting
  // ~1-2 days/boss early ramping up as index climbs, and an average boss
  // reached at death of roughly 3 (bad, 10-30% completion) / 7 (balanced,
  // 30-60%) / 15 (good, 60-90%). The old 2650/1.30 pair cleared ~1 boss/day
  // flat and gave far too little spread between archetypes (~3 to ~8).
  BASE_BOSS_POWER: 1800,
  BOSS_GROWTH_RATE: 1.16,
  BOSS_STAT_SHARE: { health: 0.4, physicalAttack: 0.2, magicAttack: 0.2, armor: 0.1, magicResist: 0.1 }, // sums to 1
  RESIST_K: 1500, // scaled with BASE_BOSS_POWER so early-game resist % is unchanged (~14% at boss 1)
  BASE_BOSS_EXP: 40, // deliberately NOT rescaled — EXP/leveling pace is a separate economy, untouched by this balance pass
  // Lowered 1.18 -> 1.12 as part of the same pacing pass as BASE_BOSS_POWER
  // above: this MUST stay below BOSS_GROWTH_RATE. If EXP income compounds
  // faster than boss difficulty, an extremely consistent player who chains
  // same-day kills for long enough can drive boss index — and therefore a
  // single kill's EXP reward — arbitrarily high, since the two curves race
  // forever and EXP would eventually win. (`addExpAndResolveLevelUps` also
  // hard-caps levels-gained-per-grant as defense in depth, but keeping this
  // rate strictly lower is what actually prevents the runaway in practice.)
  BOSS_EXP_GROWTH_RATE: 1.12,
  // Lowered 0.3 -> 0.17 as part of the same pacing pass as BASE_BOSS_POWER/
  // BOSS_GROWTH_RATE above: a low-completion ("bad") player accumulates far
  // more misses than anyone else, so this specifically stretches their
  // survivable run length without meaningfully changing a high-completion
  // player's pace (they rarely miss). See BASE_BOSS_POWER's comment for the
  // simulation this was tuned against.
  MISS_DAMAGE_FACTOR: 0.17,
  BASE_CRIT_CHANCE: 0.01, // 1% base crit chance for the player (see leveling.ts effectiveCritChance)
  CRIT_CHANCE_CAP: 0.75, // crit chance (after item bonuses) can never exceed this, so hits are never guaranteed
  CRIT_MULTIPLIER: 2, // crit hits deal 2x damage
  // Weeklies only trigger once a week (vs. a daily every day), so each
  // trigger is worth more to keep them meaningfully influential.
  WEEKLY_REWARD_MULTIPLIER: 3, // a completed/avoided weekly deals 3x damage/healing
  WEEKLY_MISS_MULTIPLIER: 2, // a missed/failed weekly deals 2x damage to the player
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.4, magic: 0.4, healing: 0.2 },
  // Each stat-emphasis family (armored/warded/brute/arcane) escalates
  // 2x -> 3x -> 4x(-> 5x for armor/magicResist), and each tier is 5x rarer
  // than the one below it — the same ratio ITEM_CATALOG's RARITY_WEIGHT uses
  // for common:uncommon:rare:epic — so a boss with an extreme multiplier is
  // a rare, memorable spike rather than the norm.
  BOSS_PERSONALITY_WEIGHTS: {
    balanced: 100,
    tank: 100,
    armored: 100,
    armored3x: 20,
    armored4x: 4,
    armored5x: 0.8,
    warded: 100,
    warded3x: 20,
    warded4x: 4,
    warded5x: 0.8,
    brute: 100,
    brute3x: 20,
    brute4x: 4,
    arcane: 100,
    arcane3x: 20,
    arcane4x: 4,
  },
  // Each personality's weight above linearly closes the gap to the common
  // tier's weight (100) as the boss index climbs from 1 to this value, so
  // rarity is a real early-game surprise but stops gatekeeping which boss
  // types show up once a run gets deep — by this boss, every personality
  // is equally likely.
  BOSS_PERSONALITY_RAMP_END_INDEX: 15,
  // Every boss rolls a crit chance independently of its personality: usually
  // a small 0-3% roll, but a rare 5% chance instead grants a flat 20% —
  // a dangerous outlier rather than a smooth curve.
  BOSS_DEFAULT_CRIT_CHANCE_MAX: 0.03,
  BOSS_RARE_CRIT_CHANCE_PROBABILITY: 0.05,
  BOSS_RARE_CRIT_CHANCE: 0.2,
  // Reflect (% of damage taken thrown back at the player) and lifesteal (%
  // of damage dealt to the player healed back to the boss), each rolled
  // independently of personality via pickWeighted. Weight ratios mirror the
  // same "much rarer at each step up" shape as BOSS_PERSONALITY_WEIGHTS:
  // most bosses get none, a fifth get the low tier, and the highest tier is
  // rare enough to be a genuine surprise.
  BOSS_REFLECT_WEIGHTS: { '0': 80, '0.05': 15, '0.1': 4, '0.2': 1 },
  BOSS_LIFESTEAL_WEIGHTS: { '0': 80, '0.05': 15, '0.1': 4, '0.15': 1 },
  ITEM_DROP_EVERY_N_BOSSES: 3, // bosses 1-3 drop 1 item, 4-6 drop 2, 7+ drop 3 (capped)
  ITEM_DROP_MAX_COUNT: 3,
  // Physical/magic starting-stat split: createCharacter picks one of these
  // [physical share, magic share] pairs uniformly at random, so some runs
  // are balanced and others lean hard into one damage type. Applied to the
  // combined physicalDamage+magicDamage pool from BASE_STATS before the
  // usual ±5% jitter.
  DAMAGE_SPLIT_RATIOS: [
    [0.5, 0.5],
    [0.6, 0.4],
    [0.7, 0.3],
    [0.4, 0.6],
    [0.3, 0.7],
  ],
  // Special: at SPECIAL_LEVEL, a random daily good habit permanently deals
  // SPECIAL_MULTIPLIER damage on its first (non-Overdrive) use each period.
  SPECIAL_LEVEL: 3,
  SPECIAL_MULTIPLIER: 1.5,
  // Ult: at ULT_LEVEL, a random weekly good habit permanently deals
  // ULT_MULTIPLIER damage on its first (non-Overdrive) use each period.
  ULT_LEVEL: 6,
  ULT_MULTIPLIER: 2.5,
  // Overdrive: each level gained independently rolls this chance to grant a
  // random good habit (any period) the ability to be activated
  // OVERDRIVE_MAX_EXTRA_USES extra times per period, each at
  // OVERDRIVE_DAMAGE_FACTOR damage (and never with the Special/Ult bonus).
  // Permanent and stacking — a habit that already has it is a valid, no-op
  // re-roll, so over a long run many habits can end up Overdrive-capable.
  OVERDRIVE_CHANCE_PER_LEVEL: 0.6,
  OVERDRIVE_MAX_EXTRA_USES: 2,
  OVERDRIVE_DAMAGE_FACTOR: 0.5,
} as const;
