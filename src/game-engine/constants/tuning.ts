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
  // physicalDamage+magicDamage pool (0.3 * 1600 = 480).
  // physicalDamage/magicDamage/healing cut ~30% (800/800/384 -> 560/560/269)
  // when daily/weekly pools were split (see habitStore.habitsOfType) —
  // splitting one shared pool into two lets a player with both a daily and
  // a weekly habit of the same type draw from the full stat on two
  // independent schedules instead of splitting one, a net damage/healing
  // buff that needed offsetting at the source. trueDamage is deliberately
  // exempted (kept at its original 480) — its ratio comment above no longer
  // holds exactly as a result, by choice.
  // healing cut a further ~30% (269 -> 188) after the item catalog's healing
  // bonuses piled up and healing skills outpaced the other damage types.
  // The expGain skill type was removed (a long streak on one scaled income to
  // 3-7x the reference pace in simulation); EXP now comes from boss kills,
  // streak milestones, and quests, plus the equipped-item EXP bonus.
  BASE_STATS: { physicalDamage: 560, magicDamage: 560, healing: 188, health: 1250, trueDamage: 480 },
  // The same ~30% cut as the BASE_STATS change above, applied once to an
  // in-progress run's existing physicalDamage/magicDamage/healing via
  // character.ts's applyDamagePoolRebalance — a fresh character already
  // gets the reduced BASE_STATS value, but an existing save's starterStats
  // were rolled before this cut and need retroactively scaling down to
  // match (health/trueDamage untouched, same exemption as above).
  ONE_TIME_DAMAGE_POOL_REBALANCE_PCT: 30,
  // The healing-only cut above (269 -> 188), applied once to an in-progress
  // run's existing healing via character.ts's applyHealingRebalance.
  ONE_TIME_HEALING_REBALANCE_PCT: 30,
  // Each additional medium-weight habit (easy/hard scale proportionally) in a
  // damage-type pool grows that pool by this fraction of its base size — see
  // `poolSizeMultiplier`.
  POOL_GROWTH_PER_MEDIUM_HABIT: 0.2,
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level
  // Bumped from 0.01 (+1%/streak) to 0.10 (+10%/streak) so a well-kept
  // streak actually keeps pace with the exponential boss curve below —
  // streak 10 -> 2x, streak 30 -> 4x, streak 100 -> 11x damage.
  STREAK_MULTIPLIER_PER_COUNT: 0.10,
  // Weeklies take much longer to stack a streak (once/week vs. every day),
  // so each streak count is worth 3x as much as a daily's.
  WEEKLY_STREAK_MULTIPLIER_PER_COUNT: 0.30,
  // Boss health at index 1, and its per-index exponential growth. Armor and
  // magicResist no longer draw from a shared power budget (a fixed RESIST_K
  // made `resist / (resist + K)` saturate past ~80% by boss 20 for every
  // boss regardless of personality) — they're authored directly as damage
  // reduction percents below, so health grows faster to keep effective HP
  // (health / (1 - reduction)) close to the old curve through boss ~20.
  BASE_BOSS_HEALTH: 650,
  BOSS_HEALTH_GROWTH_RATE: 1.285,
  // Tank personality's health multiplier over a balanced boss.
  BOSS_TANK_HEALTH_MULTIPLIER: 1.5,
  // Non-emphasized armor/magicResist damage reduction: a straight line from
  // START at boss 1 to END at RAMP_END_INDEX, flat afterward. Armored/warded
  // bosses ramp from this same line toward their tier cap over the same
  // index range (see resistPctForIndex in boss.ts), so tanky bosses look
  // like everyone else early and only diverge deep into a run.
  BOSS_RESIST_BASE_PCT_START: 0.1,
  BOSS_RESIST_BASE_PCT_END: 0.35,
  BOSS_RESIST_RAMP_END_INDEX: 30,
  // Reduction an armored/warded boss reaches at RAMP_END_INDEX, keyed by the
  // personality's multiplier tier (2x/3x/4x/5x).
  BOSS_RESIST_TIER_CAP_PCT: { 2: 0.55, 3: 0.7, 4: 0.82, 5: 0.9 } as Record<number, number>,
  // Each run's bosses are scaled by a hidden ±10% multiplier, rolled once
  // per run (see rollRunDifficultyModifier) and never shown in the UI, so
  // some runs are quietly a bit tougher or easier throughout than the
  // tuned baseline above — replay variety without the player being able to
  // tell how hard their current run is stacked to be.
  RUN_DIFFICULTY_VARIANCE_PCT: 0.1,
  // Converts a damage reduction percent to the armor/magicResist stat shown
  // and fed through damageReductionPct: stat = K * r / (1 - r).
  RESIST_K: 1500,
  // 40 -> 33 (40 / 1.2, rounded down) back when quests were a 40%-per-boss-kill
  // EXP source. That income no longer exists (quests v2 pays a level-based
  // weekly curve instead — see QUEST_* below), so this value is deliberately
  // left as-is for play-testing; recalibrating it against the new quest
  // slice is a follow-up (docs/superpowers/specs/2026-10-21-quests-v2-design.md,
  // "Calibration"). BOSS_EXP_GROWTH_RATE is untouched.
  BASE_BOSS_EXP: 33,
  // Lowered 1.18 -> 1.12 as part of the same pacing pass as the old boss power
  // curve: this MUST stay below BOSS_HEALTH_GROWTH_RATE. If EXP income compounds
  // faster than boss difficulty, an extremely consistent player who chains
  // same-day kills for long enough can drive boss index — and therefore a
  // single kill's EXP reward — arbitrarily high, since the two curves race
  // forever and EXP would eventually win. (`addExpAndResolveLevelUps` also
  // hard-caps levels-gained-per-grant as defense in depth, but keeping this
  // rate strictly lower is what actually prevents the runaway in practice.)
  BOSS_EXP_GROWTH_RATE: 1.12,
  // Lowered 0.3 -> 0.17, then -> 0.15 in a boss-growth follow-up pass
  // above: a low-completion ("bad") player accumulates far more misses than
  // anyone else, so this specifically stretches their survivable run length
  // without meaningfully changing a high-completion player's pace (they
  // rarely miss) — the 1.205 growth-rate bump alone pulled "bad" down
  // slightly below its target, and this nudge brought it back.
  MISS_DAMAGE_FACTOR: 0.15,
  // Governs physicalAttack/magicAttack — the stats that hurt the player on
  // a missed habit — via an S-curve (logistic) over boss index instead of
  // the unbounded exponential boss health uses: see
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
  // [boss index, player level] control points for the level an average
  // player has when that boss spawns (linear between points, extrapolated
  // past the last). Boss attacks are sized against the health of this
  // expected level, blended toward the player's real level by
  // BOSS_ATTACK_LEVEL_FOLLOW (0 = ignore the player's level, 1 = always
  // scale to it), so levels above expected shrink each hit as a % of max HP.
  // Calibrated from a 52-week sim of an ~83%-completion player (1 quest/wk,
  // normal milestones, no expGain skills): median level at each boss spawn.
  // Recompute if BASE_BOSS_EXP, BOSS_EXP_GROWTH_RATE, milestone EXP or the
  // quest curve change.
  EXPECTED_LEVEL_BY_BOSS_INDEX: [
    [1, 1],
    [5, 4],
    [10, 7],
    [15, 12],
    [20, 19],
    [25, 30],
    [30, 45],
    [40, 82],
  ] as [number, number][],
  BOSS_ATTACK_LEVEL_FOLLOW: 0.5,
  // Unconditional per-level heal on top of any lifesteal-item bonus (see
  // addExpAndResolveLevelUps) — applied once per level gained in a grant.
  LEVEL_UP_HEAL_PCT: 20,
  // The Heal event restores this % of max health.
  EVENT_HEAL_PCT: 10,
  // The Crit boost event adds CRIT_BOOST_BONUS to crit chance (still subject
  // to CRIT_CHANCE_CAP) for CRIT_BOOST_DAYS days, counting the day it's picked.
  CRIT_BOOST_BONUS: 0.2,
  CRIT_BOOST_DAYS: 3,
  // The Healing boost event multiplies healing by (1 + HEAL_BOOST_BONUS) for
  // HEAL_BOOST_DAYS days, counting the day it's picked. Stacks multiplicatively
  // with Wounds (see healingMultiplier in combat.ts).
  HEAL_BOOST_BONUS: 0.2,
  HEAL_BOOST_DAYS: 3,
  // The Double item event (from DOUBLE_ITEM_MIN_LEVEL) multiplies every bonus
  // of one equipped item by DOUBLED_ITEM_MULTIPLIER until that item is discarded.
  DOUBLE_ITEM_MIN_LEVEL: 10,
  DOUBLED_ITEM_MULTIPLIER: 2,
  BASE_CRIT_CHANCE: 0.01, // 1% base crit chance for the player (see leveling.ts effectiveCritChance)
  CRIT_CHANCE_CAP: 0.75, // crit chance (after item bonuses) can never exceed this, so hits are never guaranteed
  CRIT_MULTIPLIER: 2, // crit hits deal 2x damage
  // A flat reward bump for weekly habits — see weeklyBonusMultiplier in
  // combat.ts. Deliberately kept OUT of baseDamage (unlike the old,
  // removed WEEKLY_REWARD_MULTIPLIER) so the UI can show it as its own
  // line in the stats modal instead of hiding it inside the base number.
  WEEKLY_BONUS_MULTIPLIER: 2,
  WEEKLY_MISS_MULTIPLIER: 2, // a missed/failed weekly deals 2x damage to the player
  // Quests v2 (see quests.ts): a regular quest pays a share of the EXP needed
  // for the player's next level, decaying with each completion in the same
  // calendar week.
  // How many quests per week count as the baseline. Any positive number
  // (fractions interpolate); slot rewards are rescaled so the first N slots
  // sum to exactly the weekly target.
  QUESTS_PER_WEEK_ON_CURVE: 1,
  // A medium slot-1 quest pays this fraction of expToNextLevel at completion.
  QUEST_TARGET_LEVEL_FRACTION: 0.15,
  // Floor on the weekly target so early quests (where the fraction is tiny) still pay something.
  QUEST_MIN_TARGET_EXP: 10,
  // Percent of the weekly target paid by the 1st, 2nd, ... completion in a
  // calendar week; slots past the end pay 0 (hard ceiling: sum is 232).
  QUEST_SLOT_WEIGHTS: [100, 60, 35, 20, 10, 5, 2],
  QUEST_DIFFICULTY_MULT: { easy: 0.7, medium: 1, hard: 1.3 },
  // Level-up picks that can pass with the side-quest event eligible but not
  // offered before it is forced into the next pick.
  SIDE_QUEST_GUARANTEE_LEVELS: 5,
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.38, magic: 0.38, healing: 0.16, trueDamage: 0.08 },
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
  // Special: from SPECIAL_LEVEL the Special event can be picked, making a
  // random daily good habit permanently deal SPECIAL_MULTIPLIER damage on
  // its first (non-Overdrive) use each period.
  SPECIAL_LEVEL: 3,
  SPECIAL_MULTIPLIER: 1.5,
  // Ult: from ULT_LEVEL the Ult event can be picked, making a random weekly
  // good habit permanently deal ULT_MULTIPLIER damage on its first
  // (non-Overdrive) use each period.
  ULT_LEVEL: 6,
  ULT_MULTIPLIER: 2.5,
  // Overdrive: the Overdrive event grants a random good habit (any period)
  // the ability to be activated OVERDRIVE_MAX_EXTRA_USES extra times per
  // period, each at OVERDRIVE_DAMAGE_FACTOR damage (and never with the
  // Special/Ult bonus). Permanent and stacking — a habit that already has it
  // is a valid, no-op pick, so over a long run many habits can end up
  // Overdrive-capable.
  OVERDRIVE_MAX_EXTRA_USES: 2,
  OVERDRIVE_DAMAGE_FACTOR: 0.5,
  // Epic signature and relic effects (see itemEffects.ts and the item's
  // `effect` in constants/itemCatalog.ts). *_PCT thresholds are boss/player
  // health fractions; *_HEAL_PCT values are percents of max health.
  ITEM_EFFECTS: {
    GIANTSLAYER_ABOVE_PCT: 0.75,
    GIANTSLAYER_MULTIPLIER: 1.3,
    HEADSMAN_BELOW_PCT: 0.25,
    HEADSMAN_MULTIPLIER: 1.5,
    VOID_CRIT_MULTIPLIER: 3,
    BLOODTHORN_CRIT_HEAL_PCT: 5,
    SPELLWEAVE_PER_SKILL: 0.05,
    SPELLWEAVE_MAX_STACKS: 5,
    TITANS_MENDING_BELOW_PCT: 0.5,
    TITANS_MENDING_MULTIPLIER: 1.5,
    CENSER_DAMAGE_FRACTION: 0.5,
    TEMPERANCE_MULTIPLIER: 1.5,
    MOONWELL_MULTIPLIER: 1.5,
    BANNER_MILESTONE_MULTIPLIER: 2,
    DAWNGUARD_FACTOR: 0.5,
    SAGES_INSIGHT_LEVEL_UP_HEAL_PCT: 40,
    EMBER_HEART_HEAL_PCT: 5,
    SOUL_LANTERN_HEAL_PCT: 15,
    QUILL_EXP_MULTIPLIER: 1.5,
    MAGPIE_BOSS_INDEX_BONUS: 10,
  },
} as const;
