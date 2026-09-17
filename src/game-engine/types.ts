export type DamageType = 'physical' | 'magic' | 'healing';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Period = 'daily' | 'weekly';

export type Personality = 'balanced' | 'tank' | 'armored' | 'warded' | 'brute';

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
  critChance: number; // fixed, not scaled by index — see TUNING.BASE_CRIT_CHANCE
}

export interface Habit {
  id: string;
  name: string;
  period: Period;
  difficulty: Difficulty;
  damageType: DamageType;
  streakCount: number;
  lastCompletedPeriodKey: string | null;
  lastCheckedPeriodKey: string | null;
}
