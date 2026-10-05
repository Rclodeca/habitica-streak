export const TUNING = {
  // Scaled up ~30x from the original 10/10/6/50 (see PROGRESS.md "Balance
  // rescale") so that a 1% streak/item bonus moves the displayed (rounded)
  // damage number by more than a rounding error, and so one day of fully
  // completing physical+magic habits can actually kill boss 1.
  // healing cut 480 -> 384 (-20%) alongside merging good/bad habit pools
  // (see HABIT_DAMAGE_TYPE_WEIGHTS/habitsOfType) — more habits now draw from
  // one healing budget instead of a good-only one, so the per-habit share
  // would otherwise have gone up instead of staying flat.
  // trueDamage was originally sized at 30% of the combined
  // physicalDamage+magicDamage pool (0.3 * 1600 = 480); expGain at 30% of
  // boss 1's kill reward (0.3 * BASE_BOSS_EXP = 0.3 * 40 = 12) — see
  // leveling.ts for why it scales with player level (not boss index) to
  // avoid racing BOSS_EXP_GROWTH_RATE.
  // physicalDamage/magicDamage/healing cut ~30% (800/800/384 -> 560/560/269)
  // when daily/weekly pools were split (see habitStore.habitsOfType) —
  // splitting one shared pool into two lets a player with both a daily and
  // a weekly habit of the same type draw from the full stat on two
  // independent schedules instead of splitting one, a net damage/healing
  // buff that needed offsetting at the source. trueDamage/expGain are
  // deliberately exempted (kept at their original 480/12) — their ratio
  // comment above no longer holds exactly as a result, by choice.
  BASE_STATS: { physicalDamage: 560, magicDamage: 560, healing: 269, health: 1250, trueDamage: 480, expGain: 12 },
  // The same ~30% cut as the BASE_STATS change above, applied once to an
  // in-progress run's existing physicalDamage/magicDamage/healing via
  // character.ts's applyDamagePoolRebalance — a fresh character already
  // gets the reduced BASE_STATS value, but an existing save's starterStats
  // were rolled before this cut and need retroactively scaling down to
  // match (health/trueDamage/expGain untouched, same exemption as above).
  ONE_TIME_DAMAGE_POOL_REBALANCE_PCT: 30,
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level
  // Bumped from 0.01 (+1%/streak) to 0.10 (+10%/streak) so a well-kept
  // streak actually keeps pace with the exponential boss curve below —
  // streak 10 -> 2x, streak 30 -> 4x, streak 100 -> 11x damage.
  STREAK_MULTIPLIER_PER_COUNT: 0.10,
  // Weeklies take much longer to stack a streak (once/week vs. every day),
  // so each streak count is worth 3x as much as a daily's.
  WEEKLY_STREAK_MULTIPLIER_PER_COUNT: 0.30,
  // Lowered 2650 -> 1800, alongside retaining habit streaks across death
  // (see resolvePlayerDeathIfDead) and MISS_DAMAGE_FACTOR below, as a
  // coordinated pacing pass — tuned via a throwaway per-life simulation
  // (spawn-to-death, not a fixed day window) across completion-rate
  // archetypes. The old 2650/1.30 pair cleared ~1 boss/day flat and gave
  // far too little spread between archetypes (~3 to ~8).
  BASE_BOSS_POWER: 1800,
  // BOSS_GROWTH_RATE bumped 1.16 -> 1.205 in a follow-up pass (bad/balanced
  // were already on target; only the high-completion tiers needed pulling
  // back in) once two more archetypes (good+ 80-90%, amazing 80-100%, extra
  // amazing 90-100%) were added, targeting a rough avg-boss-at-death curve
  // of bad 3 / balanced 6 / good 9 / good+ 12 / amazing 15 / extra amazing
  // 20 — approximate by design, not meant to hit exactly. 1.16 alone gave
  // too little separation between the top two tiers (~24 vs ~20).
  BOSS_GROWTH_RATE: 1.205,
  // Each run's bosses are scaled by a hidden ±10% multiplier, rolled once
  // per run (see rollRunDifficultyModifier) and never shown in the UI, so
  // some runs are quietly a bit tougher or easier throughout than the
  // tuned baseline above — replay variety without the player being able to
  // tell how hard their current run is stacked to be.
  RUN_DIFFICULTY_VARIANCE_PCT: 0.1,
  BOSS_STAT_SHARE: { health: 0.4, physicalAttack: 0.2, magicAttack: 0.2, armor: 0.1, magicResist: 0.1 }, // sums to 1
  RESIST_K: 1500, // scaled with BASE_BOSS_POWER so early-game resist % is unchanged (~14% at boss 1)
  // 40 -> 33 (40 / 1.2, rounded down): offsets the new quest-completion EXP
  // income (see quests.ts/questExpReward) — assuming every offered quest is
  // accepted and completed on time (the generous upper bound) and an
  // average difficulty pick of "medium", expected extra EXP per boss kill is
  // QUEST_DROP_CHANCE * QUEST_EXP_DIFFICULTY_PCT.medium = 0.4 * 0.5 = 20% on
  // top of this reward — dividing by 1.2 holds overall leveling pace roughly
  // where it was. Real-world accept/completion rates will be below 100%, so
  // this cut is deliberately conservative (a slight net buff once quests
  // ship), not an exact wash — same "approximate by design" philosophy as
  // every other pass in this file. BOSS_EXP_GROWTH_RATE is untouched.
  BASE_BOSS_EXP: 33,
  // Lowered 1.18 -> 1.12 as part of the same pacing pass as BASE_BOSS_POWER
  // above: this MUST stay below BOSS_GROWTH_RATE. If EXP income compounds
  // faster than boss difficulty, an extremely consistent player who chains
  // same-day kills for long enough can drive boss index — and therefore a
  // single kill's EXP reward — arbitrarily high, since the two curves race
  // forever and EXP would eventually win. (`addExpAndResolveLevelUps` also
  // hard-caps levels-gained-per-grant as defense in depth, but keeping this
  // rate strictly lower is what actually prevents the runaway in practice.)
  BOSS_EXP_GROWTH_RATE: 1.12,
  // Lowered 0.3 -> 0.17, then -> 0.15 in the BOSS_GROWTH_RATE follow-up pass
  // above: a low-completion ("bad") player accumulates far more misses than
  // anyone else, so this specifically stretches their survivable run length
  // without meaningfully changing a high-completion player's pace (they
  // rarely miss) — the 1.205 growth-rate bump alone pulled "bad" down
  // slightly below its target, and this nudge brought it back.
  MISS_DAMAGE_FACTOR: 0.15,
  // Governs physicalAttack/magicAttack — the stats that hurt the player on
  // a missed habit — via an S-curve (logistic) over boss index instead of
  // the shared power budget every other boss stat uses: see
  // missDamagePctForIndex in boss.ts. It starts small, rises through the
  // two checkpoints below, and plateaus near this ceiling % of the
  // player's BASE (pre-item) max health afterward, instead of growing
  // unbounded forever. Deliberately keyed off BASE health, not the
  // item-boosted effective health, so equipping health items still makes a
  // real dent in the resulting hit-as-%-of-actual-max-HP — see
  // generateBoss's baseMaxHealth param. Personality multipliers apply on
  // top of this curve, so brute/arcane 2x-5x bosses still climb past the
  // ceiling and remain a genuine one-shot threat — only the non-emphasized
  // baseline is tamed.
  // Must stay strictly above MISS_DAMAGE_CURVE_TARGET_PCT — it's the
  // asymptote the curve approaches but never reaches at the target
  // checkpoint itself.
  MISS_DAMAGE_CEILING_PCT_OF_MAX_HP: 0.75,
  // The curve's two authored checkpoints — its midpoint/steepness are
  // solved from these (see solveLogisticParams in boss.ts) so the shape is
  // tuned via "how small at the start" and "where it hits the target"
  // rather than raw sigmoid math constants.
  MISS_DAMAGE_CURVE_EARLY_INDEX: 1,
  MISS_DAMAGE_CURVE_EARLY_PCT: 0.05,
  MISS_DAMAGE_CURVE_TARGET_INDEX: 50,
  MISS_DAMAGE_CURVE_TARGET_PCT: 0.7,
  // Unconditional per-level heal on top of any lifesteal-item bonus (see
  // addExpAndResolveLevelUps) — applied once per level gained in a grant.
  LEVEL_UP_HEAL_PCT: 20,
  BASE_CRIT_CHANCE: 0.01, // 1% base crit chance for the player (see leveling.ts effectiveCritChance)
  CRIT_CHANCE_CAP: 0.75, // crit chance (after item bonuses) can never exceed this, so hits are never guaranteed
  CRIT_MULTIPLIER: 2, // crit hits deal 2x damage
  // A flat reward bump for weekly habits — see weeklyBonusMultiplier in
  // combat.ts. Deliberately kept OUT of baseDamage (unlike the old,
  // removed WEEKLY_REWARD_MULTIPLIER) so the UI can show it as its own
  // line in the stats modal instead of hiding it inside the base number.
  WEEKLY_BONUS_MULTIPLIER: 2,
  WEEKLY_MISS_MULTIPLIER: 2, // a missed/failed weekly deals 2x damage to the player
  // Flat chance a boss kill offers a quest, independent of boss index —
  // quests are a pacing/flavor mechanic, not a progression-scaling reward
  // like items, so no growth curve to tune. See quests.ts/rollQuestOffer.
  QUEST_DROP_CHANCE: 0.4,
  // questExpReward scales a completed quest's bonus EXP by this percent of
  // the EXP reward of the boss that offered it (quest.bossIndexAtOffer) —
  // see quests.ts. Inherits BOSS_EXP_GROWTH_RATE's existing curve for free
  // instead of needing a second independent growth rate to verify against
  // the runaway-prevention margin (see BOSS_EXP_GROWTH_RATE's own comment).
  QUEST_EXP_DIFFICULTY_PCT: { easy: 0.25, medium: 0.5, hard: 0.75 },
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.35, magic: 0.35, healing: 0.15, trueDamage: 0.08, expGain: 0.07 },
  // Each stat-emphasis family (armored/warded/brute/arcane) escalates
  // 2x -> 3x -> 4x -> 5x, and each tier is 5x rarer than the one below it —
  // the same ratio ITEM_CATALOG's RARITY_WEIGHT uses for
  // common:uncommon:rare:epic — so a boss with an extreme multiplier is a
  // rare, memorable spike rather than the norm.
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
    brute5x: 0.8,
    arcane: 100,
    arcane3x: 20,
    arcane4x: 4,
    arcane5x: 0.8,
  },
  // Each personality's weight above linearly closes the gap to the common
  // tier's weight (100) as the boss index climbs from 1 to this value, so
  // rarity is a real early-game surprise but stops gatekeeping which boss
  // types show up once a run gets deep — by this boss, every personality
  // is equally likely. Pushed 15 -> 50 alongside the miss-damage S-curve
  // (see MISS_DAMAGE_CURVE_* above): the rare 3x-5x attack-emphasis tiers
  // can already one-shot a player once their raw odds are non-negligible
  // (brute3x hit 100% of max HP by boss 10 at the old ramp), so they need
  // to stay rare for longer, not just cap out early.
  BOSS_PERSONALITY_RAMP_END_INDEX: 50,
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
  // Wounds: a boss ability rolled once at generation (see generateBoss) —
  // 10% of bosses get it. Each time this boss lands a hit (missHabit), it
  // rolls against hitChance; on success, if the player isn't already
  // Wounded, healing is multiplied by effectRate for durationDays days (no
  // stacking/refresh — see activeWoundsEffect in combat.ts). All three
  // values are rolled independently once per boss and fixed for its
  // lifetime, so some Wounds bosses are a near-certain, short, mild
  // nuisance while others are a rare but long, harsh one.
  WOUNDS_ABILITY_CHANCE: 0.1,
  WOUNDS_HIT_CHANCE_MIN: 0.2,
  WOUNDS_HIT_CHANCE_MAX: 0.8,
  WOUNDS_DURATION_DAYS_OPTIONS: [1, 2, 3],
  WOUNDS_EFFECT_RATE_OPTIONS: [0.25, 0.5], // picked via pickRandom, i.e. 50/50 odds
  // Total armorPen/magicPen percent from equipped items is clamped to this
  // before reducing a boss's effective armor/magicResist (see combat.ts) —
  // mirrors how CRIT_CHANCE_CAP keeps crit under 100%. A boss always
  // retains at least 10% of its true resist no matter how much pen is stacked.
  ARMOR_MAGIC_PEN_CAP_PCT: 90,
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
