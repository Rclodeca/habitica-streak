export type DamageType = 'physical' | 'magic' | 'healing';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Period = 'daily' | 'weekly';

// Each emphasized-stat family (armored/warded/brute/arcane) has an
// escalating 2x/3x/4x(/5x) tier — see PERSONALITY_MULTIPLIER in boss.ts —
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
  | 'arcane'
  | 'arcane3x'
  | 'arcane4x';

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
}
