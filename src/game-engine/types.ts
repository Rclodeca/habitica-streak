export type DamageType = 'physical' | 'magic' | 'healing' | 'trueDamage';

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
  // Chosen on the new-hero screen (NewHeroScreen.vue). Undefined means not
  // named yet: createCharacter never sets it, so the first launch and every
  // new run after a death show that screen until the hero is named. A save
  // from before names existed loads unnamed too, so it gets asked once.
  name?: string;
  level: number;
  exp: number;
  starterStats: {
    physicalDamage: number;
    magicDamage: number;
    healing: number;
    health: number;
    trueDamage: number;
  };
  currentHealth: number;
  ownedItemIds: string[]; // items the character has; equal to equippedItemIds except for drops still waiting in the popup queue
  equippedItemIds: string[]; // subset of ownedItemIds, length <= maxEquipSlots
  // Rolled once per run by assignNewItemUnlockTiers (see character.ts),
  // mapping each level-gated item's id to the player level at which it
  // starts being droppable. Optional so an existing save (no schema-version
  // bump) still loads — undefined is treated as "every level-gated item is
  // locked" by rollItemDrops, same conservative-default pattern as
  // difficultyModifier?/statusEffects? elsewhere in this file.
  // The player's next death naturally re-rolls a fresh assignment.
  newItemUnlockTiers?: Record<string, 10 | 15 | 20>;
  critChance: number; // base crit chance (0-1), before item bonuses — see effectiveCritChance
  // Optional so an existing save (no schema-version bump) still loads;
  // undefined is treated as "no active effects" everywhere this is read —
  // see activeWoundsEffect in combat.ts. A fresh character (createCharacter,
  // resolvePlayerDeathIfDead) never sets this, so a new run always starts clean.
  statusEffects?: StatusEffect[];
  // One-time migration marker: undefined means this character predates the
  // 2026-10-04 damage/healing-pool rebalance (daily/weekly pool split made
  // physicalDamage/magicDamage/healing ~30% stronger than intended) and
  // still needs applyDamagePoolRebalance run on it once; true means either
  // it's already been applied, or the character was created fresh after
  // the rebalance (createCharacter sets this immediately so the migration
  // never double-applies once a fresh character gets saved and reloaded).
  // health/trueDamage are deliberately untouched by this migration.
  damagePoolRebalanceApplied?: boolean;
  // Same one-time marker for the later healing-only cut (BASE_STATS.healing
  // 269 -> 188): undefined means applyHealingRebalance still has to run on
  // this character; createCharacter sets it true for the same no-double-cut
  // reason as above.
  healingRebalanceApplied?: boolean;
  // Events mechanic (see events.ts). `takenEventIds` holds one-time events
  // already picked this run; `pendingEventPicks` is how many level-ups are
  // still waiting for the player to choose an event. Both optional so an
  // existing save still loads — the store hydration seeds them once (see
  // initializeStores). A fresh character starts empty, so death resets them.
  // The equipped item currently doubled by the Double item event; cleared when it's discarded.
  doubledItemId?: string;
  takenEventIds?: string[];
  pendingEventPicks?: number;
  // Regular-quest completions this calendar week (undefined = none yet). Lives
  // on the character, so a death starts a fresh count along with everything
  // else in the run.
  questWeek?: QuestWeek;
  // Relics already paid out by a side quest this run (see availableRelics) —
  // kept even if the relic is later dropped, so it is never offered again
  // this run. undefined = none; a death starts a fresh run with none.
  earnedRelicIds?: string[];
  // The day key each once-a-day item effect last fired on (Dawnguard's halved
  // hit, Starfall's crit, Ember Heart's heal) — see itemEffects.ts.
  effectDayKeys?: { dawnguard?: string; starfall?: string; emberHeart?: string };
  // Skills used today while Spellweave is equipped (see spellweaveStacks).
  spellweave?: { dayKey: string; count: number };
  // Consecutive level-up picks where the side-quest event was eligible but
  // not offered — drives the guarantee in rollEventChoices.
  sideQuestPicksMissed?: number;
  // Whether the quests section is open this run (see questsOpen in
  // quests.ts). A new run starts sealed (false) until QUESTS_UNLOCK_LEVEL,
  // when dismissing the "Quests unlocked" popup sets it — or it opens at
  // once if quests carried over from the last run (useCombatActions.restart).
  // Undefined only on a save from before the lock; migrateQuestUnlock settles it.
  questsUnlocked?: boolean;
}

// Discriminated on `type`. Intentionally a plain union rather than a
// registry/plugin system — each effect has its own small lookup helper
// (activeWoundsEffect in combat.ts, activeCritBoost/activeHealBoost in leveling.ts).
export type StatusEffect = WoundsStatusEffect | CritBoostStatusEffect | HealBoostStatusEffect | BlindStatusEffect | SunderStatusEffect;

/** The Blind boss skill: no rolled crits for `durationDays` days (forced crits still land) — see activeBlind. */
export interface BlindStatusEffect {
  type: 'blind';
  appliedDayKey: string; // dailyPeriodKey() when the skill fired
  durationDays: number;
}

/** The Sunder boss skill: armor and magic resist halved for `durationDays` days — see activeSunder. */
export interface SunderStatusEffect {
  type: 'sunder';
  appliedDayKey: string; // dailyPeriodKey() when the skill fired
  durationDays: number;
}

/** Temporary crit-chance bonus granted by the Crit boost event; expires after `durationDays` days. */
export interface CritBoostStatusEffect {
  type: 'critBoost';
  appliedDayKey: string; // dailyPeriodKey() when picked
  durationDays: number;
  bonus: number; // added to crit chance, e.g. 0.2 = +20 percentage points
}

/** Temporary healing bonus granted by the Healing boost event; multiplies healing by (1 + bonus) for `durationDays` days. */
export interface HealBoostStatusEffect {
  type: 'healBoost';
  appliedDayKey: string; // dailyPeriodKey() when picked
  durationDays: number;
  bonus: number; // e.g. 0.2 = +20% healing
}

export interface WoundsStatusEffect {
  type: 'wounds';
  appliedDayKey: string; // dailyPeriodKey() at the moment the Wounds boss skill fired — see bossSkills.ts
  durationDays: number; // 2 from the boss skill; older saves may hold 1 or 3 from the retired boss trait
  effectRate: number; // 0.5 from the boss skill (0.25 only on older saves) — multiplies healing while active, see combat.ts/healingMultiplier
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
  // Hidden: the chance (0-1) a hit on the player lands physical rather than
  // magic, rolled once at generation and never shown — see generateBoss.
  // Optional so an existing save still loads; undefined means a plain 50/50.
  physicalShare?: number;
  // Set once the player first damages this boss (First Blood reads it).
  playerHasHit?: boolean;
  // Damage past 0 health on the killing blow (Echoing Blade carries it over).
  overkill?: number;
  // Hidden skills waiting at HP breakpoints, rolled once at generation from
  // boss 15 (see rollBossSkills in bossSkills.ts). Optional so an existing
  // save still loads; undefined means no skills.
  skills?: BossSkillSlot[];
  // The day key Bloodlust fired on (see bloodlustActive); undefined = never.
  bloodlustDayKey?: string;
  // The day key Undying fired on — it only holds that day (see undyingActive).
  undyingDayKey?: string;
  // The day key Doom lands on, set when it fires (see resolveDoom).
  doomDueDayKey?: string;
}

// Rend is the 20% HP hit, Ravage the 40% one.
export type BossSkillId = 'wounds' | 'bloodlust' | 'blind' | 'mend' | 'rend' | 'doom' | 'sunder' | 'undying' | 'ravage';

/** A boss's HP breakpoints, as a fraction of its max health. */
export type Breakpoint = 0.75 | 0.5 | 0.25;

/**
 * One hidden skill at a breakpoint. `spent` is set once a hit crosses it;
 * `fired` only on the slot that actually triggered (a hit crossing several
 * fires only the first, and nothing fires on a kill).
 */
export interface BossSkillSlot {
  at: Breakpoint;
  skill: BossSkillId;
  spent?: true;
  fired?: true;
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
  // Daily habits only: the weekdays it's due (Monday = 0 ... Sunday = 6, see
  // dayOfWeekIndex), sorted, 1-6 of them. Undefined means every day, so an
  // existing save still loads as plain dailies — see normalizeDays.
  days?: number[];
  // All optional so an existing save (no schema-version bump) still loads —
  // undefined is treated as "not yet assigned" everywhere these are read.
  isSpecial?: boolean; // permanent SPECIAL_MULTIPLIER bonus, assigned once at SPECIAL_LEVEL to a random daily good habit
  isUlt?: boolean; // permanent ULT_MULTIPLIER bonus, assigned once at ULT_LEVEL to a random weekly good habit
  isOverdrive?: boolean; // can be activated up to OVERDRIVE_MAX_EXTRA_USES extra times per period, each at reduced damage
  overdrivePeriodKey?: string | null; // period key overdriveUsesThisPeriod applies to — a stale key means 0 used
  overdriveUsesThisPeriod?: number;
}

/** 'regular' quests pay EXP from the weekly curve; 'side' quests (offered by an event) pay an item and no EXP. */
export type QuestKind = 'regular' | 'side';

export interface Quest {
  id: string;
  kind: QuestKind; // a save from before side quests has none; migrateQuest backfills 'regular'
  description: string; // free-text one-time task, player-authored
  difficulty: Difficulty;
  dueDateKey: string; // YYYY-MM-DD — same format as dailyPeriodKey; required for every quest
  rewardItemId?: string; // side quests only: the item granted on completion
}

/** Regular-quest completions in one calendar week — see questSlotExp in quests.ts. */
export interface QuestWeek {
  weekKey: string; // weeklyPeriodKey() of the week `completed` counts
  completed: number;
}
