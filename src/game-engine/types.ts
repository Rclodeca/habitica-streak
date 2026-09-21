export type DamageType = 'physical' | 'magic' | 'healing';

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
  };
  currentHealth: number;
  ownedItemIds: string[]; // all items ever dropped for this character (equipped + unequipped)
  equippedItemIds: string[]; // subset of ownedItemIds, length <= 4
  critChance: number; // base crit chance (0-1), before item bonuses — see effectiveCritChance
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
