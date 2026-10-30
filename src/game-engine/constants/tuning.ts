import type { BossSkillId, BossStat, Breakpoint, Period } from '../types';

export const TUNING = {
  // Per-skill stats: every skill hits for its type's full stat (no pools),
  // at 60% of the old pooled values; 8 skills is the reference loadout.
  // Sim: SKILLS=8 POOLS=0 node scripts/balance-sim.mjs
  BASE_STATS: { physicalDamage: 336, magicDamage: 336, healing: 141, health: 1250, trueDamage: 288 },
  // An earlier ~30% cut (from the daily/weekly pool split), applied once to
  // an in-progress run's physicalDamage/magicDamage/healing via
  // character.ts's applyDamagePoolRebalance. health/trueDamage untouched.
  ONE_TIME_DAMAGE_POOL_REBALANCE_PCT: 30,
  // An earlier healing-only cut (269 -> 188), applied once to an in-progress
  // run's existing healing via character.ts's applyHealingRebalance.
  ONE_TIME_HEALING_REBALANCE_PCT: 30,
  // The later healing boost (188 -> 235), applied once to an in-progress
  // run's existing healing via character.ts's applyHealBoost.
  ONE_TIME_HEAL_BOOST_FACTOR: 1.25,
  // The steeper heal ranks' base cut (235 -> 141, with HEAL_RANK_BONUS
  // 0.35 -> 1), applied once to an in-progress run's existing healing via
  // character.ts's applyHealBaseCut.
  ONE_TIME_HEAL_BASE_CUT_FACTOR: 0.6,
  // The health growth rate before LEVEL_HEALTH_HEALING_GROWTH_RATE, so
  // character.ts's applyHealthGrowthBump can scale an in-progress run's
  // currentHealth up with its (level-computed) max health.
  ONE_TIME_OLD_HEALTH_GROWTH_RATE: 0.06,
  // A ranger's (an even physical/magic split, see heroClassFor) starting
  // true damage multiplier.
  RANGER_TRUE_DAMAGE_MULTIPLIER: 1.25,
  // Crowding: the FULL_POWER_SKILLS oldest skills hit in full; the next ones
  // hit for these factors, the last for every later one (see crowdingFactor).
  FULL_POWER_SKILLS: 15,
  CROWDED_SKILL_FACTORS: [0.7, 0.5, 0.35, 0.25],
  // Healing skills crowd on their own: the FULL_POWER_HEAL_SKILLS oldest
  // (daily or weekly) heal in full, every later one at CROWDED_HEAL_SKILL_FACTOR,
  // so how many heal skills a run rolled matters less than how high they rank.
  FULL_POWER_HEAL_SKILLS: 2,
  CROWDED_HEAL_SKILL_FACTOR: 0.5,
  STAT_RANDOMIZATION_PCT: 0.05, // ±5% at character creation
  LEVEL_STAT_GROWTH_RATE: 0.06, // +6% compounding per level (damage stats)
  // Health and healing grow faster than damage, so lifesteal (a share of
  // damage dealt) shrinks against max HP over a run while heal skills keep
  // pace. Boss attacks follow, being sized against level-scaled health.
  // 9.5% puts a level-30 hero near 20k max HP (+20% health items) against a
  // ~230k boss.
  LEVEL_HEALTH_HEALING_GROWTH_RATE: 0.095,
  // Streak milestones that earn a skill's ranks I-VIII (weeklies count weeks).
  // A rank is permanent: a miss drops the streak to 0, never the rank.
  RANK_MILESTONES: {
    daily: [10, 20, 30, 50, 100, 200, 300, 500],
    weekly: [3, 7, 10, 17, 33, 67, 100, 167],
  } as Record<Period, number[]>,
  // A hit's multiplier is 1 + RANK_BONUS * rank + STREAK_BONUS * streak
  // (see rankMultiplier in streaks.ts). Healing ranks are worth as much as
  // damage ranks, on a base heal cut to 60%: unranked heals are small and a
  // well-ranked heal skill matters more to survival than having a second one.
  // Picked with a balance sim (decent player, 1 heal skill of 8: same deaths
  // as the old 235 base / +35% ranks; ranks off: ~2x the deaths at 99%).
  RANK_BONUS: 1.0,
  HEAL_RANK_BONUS: 1.0,
  STREAK_BONUS: 0.01,
  WEEKLY_STREAK_BONUS: 0.03,
  // Boss health at index 1, and its growth bands: each row's rate applies
  // from that boss on (see bossHealthGrowthRate). Armor and magicResist are
  // authored as damage reduction percents (see BOSS_RESIST_* below), not
  // drawn from a power budget. x1.15 was the first pick for 13+; x1.16 is the
  // in-between if x1.17 drags. Every band must stay well above ~x1.05, or
  // kill EXP (BOSS_KILL_LEVEL_SHARE) can buy levels faster than bosses grow.
  BASE_BOSS_HEALTH: 650,
  BOSS_HEALTH_GROWTH_BANDS: [
    [1, 1.27],
    [13, 1.17],
    [31, 1.11],
    [51, 1.09],
  ] as [number, number][],
  // The old flat growth, kept only to rescale a saved boss once (see
  // rescaleBossToHealthBands).
  LEGACY_BOSS_HEALTH_GROWTH_RATE: 1.27,
  // The per-skill cut (no pools, see BASE_STATS), applied once to an
  // in-progress run's physical, magic and true damage via
  // character.ts's applyRankRebalance. Healing and health untouched.
  ONE_TIME_RANK_REBALANCE_DAMAGE_FACTOR: 0.6,
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
  // A boss kill pays this share of the slayer's next level (see
  // bossExpReward). Kill EXP now follows level, not boss index, so it can't
  // run away on its own: a kill adds about 1.06^(share * (1 + EXP bonus)) of
  // power, and at 0.4 it takes about +270% EXP to match the deepest x1.09
  // HP band. No kill-speed scaling: faster kills already pay more often, and
  // each boss still costs more than the last. The ±10% jitter keeps level-ups
  // from feeling scheduled; the floor keeps the opening kills as they were.
  BOSS_KILL_LEVEL_SHARE: 0.4,
  BOSS_KILL_EXP_JITTER_PCT: 0.1,
  BOSS_KILL_MIN_EXP: 33,
  // Each day's due dailies share this fraction of a level, and each week's
  // weeklies this one (see skillCompletionExp). Overdrive uses pay none.
  DAILY_SKILL_LEVEL_SHARE: 0.2,
  WEEKLY_SKILL_LEVEL_SHARE: 0.3,
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
  // Eased 0.75 -> 0.65 (and the target 0.7 -> 0.6 below) after play-testing:
  // about 11% less per miss at boss 20, 14% at boss 30; boss 1 is unchanged.
  MISS_DAMAGE_CEILING_PCT_OF_MAX_HP: 0.65,
  // The curve's two authored checkpoints — its midpoint/steepness are
  // solved from these (see solveLogisticParams in boss.ts) so the shape is
  // tuned via "how small at the start" and "where it hits the target"
  // rather than raw sigmoid math constants.
  MISS_DAMAGE_CURVE_EARLY_INDEX: 1,
  MISS_DAMAGE_CURVE_EARLY_PCT: 0.05,
  MISS_DAMAGE_CURVE_TARGET_INDEX: 50,
  MISS_DAMAGE_CURVE_TARGET_PCT: 0.6,
  // [boss index, player level] control points for the level an average
  // player has when that boss spawns (linear between points, extrapolated
  // past the last). Boss attacks are sized against the health of this
  // expected level, blended toward the player's real level by
  // BOSS_ATTACK_LEVEL_FOLLOW (0 = ignore the player's level, 1 = always
  // scale to it), so levels above expected shrink each hit as a % of max HP.
  // Calibrated from the median level at each boss spawn in
  // SKILLS=8 POOLS=0 KILL_SHARE=0.4 DAILY_EXP=0.2 KILL_FLOOR=33 TABLE=1 node scripts/balance-sim.mjs
  // Recompute if kill, skill or milestone EXP, the HP bands or the quest curve change.
  EXPECTED_LEVEL_BY_BOSS_INDEX: [
    [1, 1],
    [5, 4],
    [10, 7],
    [15, 11],
    [20, 15],
    [25, 20],
    [30, 25],
    [40, 38],
    [50, 49],
  ] as [number, number][],
  BOSS_ATTACK_LEVEL_FOLLOW: 0.5,
  // Unconditional per-level heal on top of any lifesteal-item bonus (see
  // addExpAndResolveLevelUps) — applied once per level gained in a grant.
  LEVEL_UP_HEAL_PCT: 20,
  // The Heal event restores this % of max health.
  EVENT_HEAL_PCT: 10,
  // The Crit boost event adds CRIT_BOOST_BONUS to crit chance (crit chance
  // tops out at 100%) for CRIT_BOOST_DAYS days, counting the day it's picked.
  CRIT_BOOST_BONUS: 0.2,
  CRIT_BOOST_DAYS: 3,
  // The Healing boost event multiplies healing by (1 + HEAL_BOOST_BONUS) for
  // HEAL_BOOST_DAYS days, counting the day it's picked. Stacks multiplicatively
  // with Wounds (see healingMultiplier in combat.ts).
  HEAL_BOOST_BONUS: 0.2,
  HEAL_BOOST_DAYS: 3,
  // The Double item event (from DOUBLE_ITEM_MIN_LEVEL) multiplies every bonus
  // of one equipped item by DOUBLED_ITEM_MULTIPLIER until that item is discarded,
  // for up to DOUBLE_ITEM_MAX items at a time.
  DOUBLE_ITEM_MIN_LEVEL: 10,
  DOUBLE_ITEM_MAX: 2,
  DOUBLED_ITEM_MULTIPLIER: 2,
  BASE_CRIT_CHANCE: 0.01, // 1% base crit chance for the player (see leveling.ts effectiveCritChance)
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
  // calendar week: the first five each pay a full slot, then it decays;
  // slots past the end pay 0 (hard ceiling: sum is 632).
  QUEST_SLOT_WEIGHTS: [100, 100, 100, 100, 100, 60, 35, 20, 10, 5, 2],
  QUEST_DIFFICULTY_MULT: { easy: 0.7, medium: 1, hard: 1.3 },
  // Level-up picks that can pass with the side-quest event eligible but not
  // offered before it is forced into the next pick.
  SIDE_QUEST_GUARANTEE_LEVELS: 5,
  HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.35, magic: 0.35, healing: 0.15, trueDamage: 0.15 },
  // A ranger rolls true damage twice as often, taken equally from physical
  // and magic.
  RANGER_HABIT_DAMAGE_TYPE_WEIGHTS: { physical: 0.275, magic: 0.275, healing: 0.15, trueDamage: 0.3 },
  // At most this share of skills (rounded up) can roll healing — on new rolls
  // only (see healingAllowed).
  HEAL_SKILL_CAP_SHARE: 0.25,
  // A skill rolled as the GUARANTEED_HEAL_SKILL-th or later while no other
  // skill heals always rolls healing (see healingRequired), so no run goes
  // without one.
  GUARANTEED_HEAL_SKILL: 4,
  // Each stat-emphasis family (armored/warded/brute/arcane) escalates
  // 2x -> 3x -> 4x -> 5x, and each tier is 5x rarer than the one below it,
  // so a boss with an extreme multiplier is a rare, memorable spike rather
  // than the norm.
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
  // How hard a boss's hits lean toward one damage type, rolled once at
  // generation and hidden from the player: the share of its hits that go to
  // the favored type (0.5 = an even split). A brute/arcane boss always
  // favors its own type; every other personality picks a side at random.
  BOSS_ATTACK_LEAN_WEIGHTS: { '0.5': 50, '0.6': 25, '0.7': 25 },
  // Every boss rolls a crit chance independently of its personality: usually
  // a small 0-3% roll, but a rare 5% chance instead grants a flat 20% —
  // a dangerous outlier rather than a smooth curve.
  BOSS_DEFAULT_CRIT_CHANCE_MAX: 0.03,
  BOSS_RARE_CRIT_CHANCE_PROBABILITY: 0.05,
  BOSS_RARE_CRIT_CHANCE: 0.2,
  // Lifesteal (% of damage dealt to the player healed back to the boss),
  // rolled independently of personality via pickWeighted. Weight ratios
  // mirror the same "much rarer at each step up" shape as
  // BOSS_PERSONALITY_WEIGHTS: most bosses get none, a fifth get the low
  // tier, and the highest tier is rare enough to be a genuine surprise.
  // (Reflect used to roll here too; it's a boss skill now, see BOSS_SKILLS.)
  BOSS_LIFESTEAL_WEIGHTS: { '0': 80, '0.05': 15, '0.1': 4, '0.15': 1 },
  // Total armorPen/magicPen percent from equipped items is clamped to this
  // before reducing a boss's effective armor/magicResist (see combat.ts) —
  // a boss always
  // retains at least 10% of its true resist no matter how much pen is stacked.
  ARMOR_MAGIC_PEN_CAP_PCT: 90,
  // Late-game boss skills, fired at HP breakpoints (see bossSkills.ts).
  BOSS_SKILLS: {
    UNLOCK_INDEX: { wounds: 15, bloodlust: 15, blind: 15, sever: 15, mend: 15, reflect: 15, rend: 20, doom: 20, sunder: 20, undying: 20, ravage: 25, empower: 20, ascend: 25 } as Record<BossSkillId, number>,
    // [first boss index of the band, weights for 0/1/2/3 skills]; fixed bands, no blending.
    COUNT_BANDS: [[15, [65, 35, 0, 0]], [20, [45, 35, 20, 0]], [25, [30, 40, 30, 0]], [30, [25, 30, 35, 10]]] as [number, number[]][],
    SLOTS: { 1: [0.5], 2: [0.75, 0.25], 3: [0.75, 0.5, 0.25] } as Record<number, Breakpoint[]>,
    HP_HIT_SKILLS: ['rend', 'ravage', 'doom'] as BossSkillId[],
    LAST_SLOT_SKILLS: ['empower', 'ascend'] as BossSkillId[], // only roll in a boss's lowest breakpoint
    DOUBLED_STATS: ['physicalAttack', 'magicAttack', 'armor', 'magicResist'] as BossStat[], // what Empower picks from and Ascend doubles
    DURATION_DAYS: 2, // Wounds, Bloodlust, Reflect, Blind, Sever, Sunder
    WOUNDS_EFFECT_RATE: 0.5,
    BLOODLUST_HEAL_PCT: 3, // of the boss's max HP, per hit it lands
    REFLECT_PCT: 5, // of the damage the hero deals, thrown back at the hero while it runs
    MEND_HEAL_PCT: 10,
    REND_PCT: 20,
    RAVAGE_PCT: 40,
    DOOM_PCT: 50,
    DOOM_DELAY_DAYS: 3,
    SUNDER_FACTOR: 0.5,
    UNDYING_FLOOR_PCT: 10,
  },
  ITEM_DROP_EVERY_N_BOSSES: 3, // bosses 1-3 drop 1 item, 4-6 drop 2, 7+ drop 3 (capped)
  ITEM_DROP_MAX_COUNT: 3,
  // Each rarity's percent share of item drops at a player level, blended
  // linearly between rows; every level past the last row uses it. Commons
  // fade out and stop at 30, epics never get as common as early commons.
  DROP_RARITY_SHARES_BY_LEVEL: [
    [1, { common: 75, uncommon: 22, rare: 3, epic: 0 }],
    [5, { common: 55, uncommon: 33, rare: 11, epic: 1 }],
    [10, { common: 30, uncommon: 40, rare: 25, epic: 5 }],
    [20, { common: 10, uncommon: 40, rare: 38, epic: 12 }],
    [30, { common: 0, uncommon: 35, rare: 48, epic: 17 }],
  ] as [number, { common: number; uncommon: number; rare: number; epic: number }][],
  // Physical/magic starting-stat split: createCharacter picks one of these
  // [physical share, magic share] pairs uniformly at random from the ones that
  // read as the picked hero (see heroClassFor), so a warrior or a cleric leans
  // a little or hard and a ranger is even. Applied to the combined
  // physicalDamage+magicDamage pool from BASE_STATS before the usual ±5%
  // jitter.
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
    SPELLWEAVE_PER_SKILL: 0.1,
    SPELLWEAVE_MAX_STACKS: 3,
    CRIT_STREAK_PER_CRIT: 0.05,
    CRIT_STREAK_MAX_STACKS: 5,
    TITANS_MENDING_BELOW_PCT: 0.5,
    TITANS_MENDING_MULTIPLIER: 1.5,
    CENSER_DAMAGE_FRACTION: 0.5,
    WELLSPRING_DAMAGE_FRACTION: 1, // of the overhealing, as true damage
    SCALES_OF_FATE_FAIL_CHANCE: 0.5,
    OMEN_HOURGLASS_FACTOR: 0.5,
    TEMPERANCE_MULTIPLIER: 1.5,
    MOONWELL_MULTIPLIER: 2,
    BANNER_MILESTONE_MULTIPLIER: 2,
    DAWNGUARD_FACTOR: 0.5,
    SAGES_INSIGHT_LEVEL_UP_HEAL_PCT: 40,
    EMBER_HEART_HEAL_PCT: 5,
    SOUL_LANTERN_HEAL_PCT: 30,
    QUILL_EXP_MULTIPLIER: 2,
    MAGPIE_RARE_EPIC_MULTIPLIER: 2,
  },
} as const;
