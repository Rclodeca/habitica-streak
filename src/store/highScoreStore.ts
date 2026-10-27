// Tracks two independent things, each in its own localStorage key (no
// schema version) so both survive both death resets (which put boss.index
// back to 1) and any future SaveState schema bump (which starts the main
// save fresh on mismatch):
//   - `highestBossIndex`: the single highest boss index ever reached.
//   - `topRuns`: a top-10 leaderboard of full run snapshots, recorded once
//     per death (see `recordRunEnd`, called from useCombatActions.restart()
//     with the pre-reset character/boss/habits).

import { defineStore } from 'pinia';
import { daysBetweenDayKeys, DEFAULT_HERO_NAME, heroClassFor, rankForStreak } from '../game-engine';
import type { DamageType, HeroClass, Period, Personality } from '../game-engine';

const STORAGE_KEY = 'habitica-streak:highscore:v1';
const RUNS_KEY = 'habitica-streak:highscore:runs:v1';
const RUN_START_KEY = 'habitica-streak:highscore:runstart:v1';
const MAX_RUNS = 10;

export interface HighScoreRunHabit {
  name: string;
  period: Period;
  damageType: DamageType;
  isBad: boolean;
  streakCount: number;
  rank?: number; // older runs didn't save one; see runHabitRank
}

export interface HighScoreRunItem {
  id: string;
  name: string;
  icon: string;
  equipped: boolean;
  stats?: string; // bonus summary at run end (includes enchant doubling); older records fall back to the catalog
  enchanted?: boolean;
}

export interface HighScoreRunStats {
  physicalDamage: number;
  magicDamage: number;
  healing: number;
  health: number;
  trueDamage: number;
  critChance: number;
}

export interface HighScoreRun {
  id: string;
  bossIndex: number;
  level: number;
  startedDayKey: string;
  endedDayKey: string;
  daysLived: number;
  stats: HighScoreRunStats;
  habits: HighScoreRunHabit[];
  items: HighScoreRunItem[];
  // Runs saved before these were recorded have none of them: see runHero for
  // the hero, and the boss is left out of the run's sheet.
  heroName?: string;
  heroClass?: HeroClass;
  bossPersonality?: Personality; // the boss that ended the run; gives its name and art
}

/** Everything `recordRunEnd` needs about the run that just ended — the start date is tracked internally (see `currentRunStartedDayKey`). */
export interface HighScoreRunInput {
  bossIndex: number;
  level: number;
  endedDayKey: string;
  stats: HighScoreRunStats;
  habits: HighScoreRunHabit[];
  items: HighScoreRunItem[];
  heroName: string;
  heroClass: HeroClass;
  bossPersonality: Personality;
}

/** The hero who made a run. Older runs didn't save one: they read as "Nameless", with the class read off the run's final stats. */
export function runHero(run: HighScoreRun): { name: string; heroClass: HeroClass } {
  return {
    name: run.heroName ?? DEFAULT_HERO_NAME,
    heroClass: run.heroClass ?? heroClassFor({ starterStats: run.stats }),
  };
}

/** A skill's rank at the end of its run. Older runs didn't save one: they get the rank their saved streak earns, as migrateHabitRank does. */
export function runHabitRank(habit: HighScoreRunHabit): number {
  return habit.rank ?? rankForStreak(habit.streakCount, habit.period);
}

function loadHighestBossIndex(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function loadTopRuns(): HighScoreRun[] {
  const raw = localStorage.getItem(RUNS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadRunStart(): string | null {
  return localStorage.getItem(RUN_START_KEY);
}

/** Boss index first, then level, then days lived — mirrors how far-progress is ranked everywhere else in this app (see the "Best: Boss #N" readout). */
function rankRuns(runs: HighScoreRun[]): HighScoreRun[] {
  return [...runs]
    .sort((a, b) => b.bossIndex - a.bossIndex || b.level - a.level || b.daysLived - a.daysLived)
    .slice(0, MAX_RUNS);
}

export const useHighScoreStore = defineStore('highScore', {
  state: () => ({
    highestBossIndex: loadHighestBossIndex(),
    topRuns: loadTopRuns(),
    // null until the first run actually starts (see ensureRunStarted) —
    // distinct from "" so a save that predates this feature doesn't get
    // mistaken for an already-started run.
    currentRunStartedDayKey: loadRunStart() as string | null,
  }),
  actions: {
    /** No-op unless `index` beats the current record; persists immediately when it does. */
    recordBossIndex(index: number) {
      if (index <= this.highestBossIndex) return;
      this.highestBossIndex = index;
      localStorage.setItem(STORAGE_KEY, String(index));
    },

    /** Sets the in-progress run's start day, but only if one isn't already recorded — called once at app init so a brand-new save's very first run has a real start date. */
    ensureRunStarted(dayKey: string) {
      if (this.currentRunStartedDayKey) return;
      this.currentRunStartedDayKey = dayKey;
      localStorage.setItem(RUN_START_KEY, dayKey);
    },

    /**
     * Snapshots a just-ended run into the top-10 leaderboard (dropped if it
     * doesn't rank), then starts the clock on the next run from the same
     * day. `currentRunStartedDayKey` falling back to `input.endedDayKey`
     * only happens for a save that predates this feature — a same-day
     * "run" of unknown real length, rather than a crash.
     */
    recordRunEnd(input: HighScoreRunInput) {
      const startedDayKey = this.currentRunStartedDayKey ?? input.endedDayKey;
      const run: HighScoreRun = {
        id: crypto.randomUUID(),
        bossIndex: input.bossIndex,
        level: input.level,
        startedDayKey,
        endedDayKey: input.endedDayKey,
        daysLived: Math.max(1, daysBetweenDayKeys(startedDayKey, input.endedDayKey) + 1),
        stats: input.stats,
        habits: input.habits,
        items: input.items,
        heroName: input.heroName,
        heroClass: input.heroClass,
        bossPersonality: input.bossPersonality,
      };
      this.topRuns = rankRuns([...this.topRuns, run]);
      localStorage.setItem(RUNS_KEY, JSON.stringify(this.topRuns));

      this.currentRunStartedDayKey = input.endedDayKey;
      localStorage.setItem(RUN_START_KEY, input.endedDayKey);
    },
  },
});
