export type DamageType = 'physical' | 'magic' | 'healing' | 'trueDamage' | 'expGain';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Period = 'daily' | 'weekly';

// Each emphasized-stat family (armored/warded/brute/arcane) has an
// escalating 2x/3x/4x/5x tier — see PERSONALITY_MULTIPLIER in boss.ts —
// with higher tiers weighted much rarer (BOSS_PERSONALITY_WEIGHTS).
export type Personality =
  | 'balanced'
  | 'tank'
  | 'armored'
  | 'armored3x'
  | 'armored4x'
  | 'armored5x'
  | 'warded'
  | 'warded3x'
  | 'warded4x'
  | 'warded5x'
  | 'brute'
  | 'brute3x'
  | 'brute4x'
  | 'brute5x'
  | 'arcane'
  | 'arcane3x'
  | 'arcane4x'
  | 'arcane5x';

export interface Character {
  level: number;
  exp: number;
  starterStats: {
    physicalDamage: number;
    magicDamage: number;
    healing: number;
    health: number;
    trueDamage: number;
    expGain: number;
  };
  currentHealth: number;
  ownedItemIds: string[]; // all items ever dropped for this character (equipped + unequipped)
  equippedItemIds: string[]; // subset of ownedItemIds, length <= 4
  // Rolled once per run by assignNewItemUnlockTiers (see character.ts),
  // mapping each level-gated item's id to the player level at which it
  // starts being droppable. Optional so an existing save (no schema-version
  // bump) still loads — undefined is treated as "every level-gated item is
  // locked" by rollItemDrops, same conservative-default pattern as
  // difficultyModifier?/statusEffects?/woundsAbility? elsewhere in this file.
  // The player's next death naturally re-rolls a fresh assignment.
  newItemUnlockTiers?: Record<string, 10 | 15 | 20>;
  critChance: number; // base crit chance (0-1), before item bonuses — see effectiveCritChance
  // Optional so an existing save (no schema-version bump) still loads;
  // undefined is treated as "no active effects" everywhere this is read —
  // see activeWoundsEffect in combat.ts. A fresh character (createCharacter,
  // resolvePlayerDeathIfDead) never sets this, so a new run always starts clean.
  statusEffects?: StatusEffect[];
}

// Discriminated on `type` — more status effects are planned (see the Wounds
// mechanic below), but only one exists today, so this is intentionally not
// a registry/plugin system; it'll grow into a real union once a second
// effect exists.
export type StatusEffect = WoundsStatusEffect;

export interface WoundsStatusEffect {
  type: 'wounds';
  appliedDayKey: string; // dailyPeriodKey() at the moment this was applied — see combat.ts/missHabit
  durationDays: number; // copied from the triggering boss's WoundsAbility at apply-time, not a live reference to that boss
  effectRate: number; // 0.25 or 0.5 — multiplies healing while active, see combat.ts/healingMultiplier
}

export interface Boss {
  index: number;
  personality: Personality;
  maxHealth: number;
  health: number;
  physicalAttack: number;
  magicAttack: number;
  armor: number;
  magicResist: number;
  critChance: number; // randomized per boss, not scaled by index — see generateBoss
  reflectPct: number; // fraction (0-1) of damage taken reflected back at the player — see completeHabit
  lifestealPct: number; // fraction (0-1) of damage dealt to the player healed back to the boss — see missHabit
  // Hidden per-run difficulty scaling (see rollRunDifficultyModifier) —
  // carried forward to every boss within the same run, never shown in the
  // UI. Optional so an existing save (no schema-version bump) still loads;
  // undefined is treated as "roll a fresh one" the next time a boss is
  // generated for this run (see generateBoss).
  difficultyModifier?: number;
  // Optional so an existing save still loads; undefined means this boss has
  // no Wounds ability (90% of bosses) — see generateBoss/TUNING.WOUNDS_ABILITY_CHANCE.
  woundsAbility?: WoundsAbility;
}

/** A boss's Wounds ability: rolled once at generation, then fixed for the boss's lifetime — see generateBoss. */
export interface WoundsAbility {
  hitChance: number; // 0.2-0.8, rolled once
  durationDays: number; // 1 | 2 | 3, rolled once
  effectRate: number; // 0.25 | 0.5, rolled once
}

export interface Habit {
  id: string;
  name: string;
  period: Period;
  difficulty: Difficulty;
  damageType: DamageType;
  // Bad habits invert who resolves the reward vs. penalty: checking one off
  // (you did the bad thing) applies the penalty (damage to the player) that
  // a good habit only applies on a miss, while leaving one unchecked through
  // a full period (you avoided it) applies the reward (damage to the boss)
  // that a good habit only applies when checked off. See `useCombatActions`.
  isBad: boolean;
  streakCount: number;
  lastCompletedPeriodKey: string | null;
  lastCheckedPeriodKey: string | null;
  // All optional so an existing save (no schema-version bump) still loads —
  // undefined is treated as "not yet assigned" everywhere these are read.
  isSpecial?: boolean; // permanent SPECIAL_MULTIPLIER bonus, assigned once at SPECIAL_LEVEL to a random daily good habit
  isUlt?: boolean; // permanent ULT_MULTIPLIER bonus, assigned once at ULT_LEVEL to a random weekly good habit
  isOverdrive?: boolean; // can be activated up to OVERDRIVE_MAX_EXTRA_USES extra times per period, each at reduced damage
  overdrivePeriodKey?: string | null; // period key overdriveUsesThisPeriod applies to — a stale key means 0 used
  overdriveUsesThisPeriod?: number;
}
