# Habitica Streak — Gamified Habit Tracker (Core Loop MVP)

_This is a committed copy of the implementation plan used to build the MVP (originally authored at `~/.claude/plans/large-task-let-s-work-splendid-whale.md`, outside this repo). Kept here so the spec survives independently of any external plan-file store. See `PROGRESS.md` at the repo root for current status, deviations, and what's deferred._

## Context

The user wants a personal gamified habit tracker: a player character with RPG stats fights a sequence of increasingly difficult bosses. Completing daily/weekly habits deals damage to the current boss (damage split across all habits of the same damage-type so adding more habits doesn't inflate total damage output — harder habits pull a bigger share). Missing a habit lets the boss damage the player. Streaks build per-habit and grant a growing damage multiplier plus EXP bonuses at milestone counts. Bosses scale up exponentially after each kill, with randomized "personality" stat emphasis; the player scales via EXP-driven leveling and streak multipliers. Player death (HP to 0) resets the run. The sibling `habitica` repo (full Habitica open-source codebase, at `/Users/ryan.clode/sn/person/habitica`) was used as a reference for architecture conventions and combat/leveling formulas; `habitica-images` (GitHub: `HabitRPG/habitica-images`) is the user's intended source for real sprite art in a later phase.

No spec document exists beyond this plan and the original seed doc (`Seed task.txt` in this repo) — this plan file is the binding authority for implementation.

## Global Constraints

**Scope**: Full core-loop MVP — character creation, habit CRUD + damage-split, boss fight with scaling/advancing, streaks + multipliers + milestones, leveling, death/reset, basic UI (character/boss panels with tap-for-stats, habit list with checkmark-to-complete). **Deferred to a later plan, not yet implemented**: items/equipment/gear, combat animations/polish beyond instant state-driven UI updates, real sprite art (placeholder static images only).

**Platform/persistence**: Responsive web app / PWA. Local-only persistence via browser `localStorage` — no backend, no accounts, single device.

**Stack**: Vue 3 (Composition API, `<script setup>`) + TypeScript + Vite + Pinia. No `vue-router` (single screen). No Bootstrap/any CSS framework (hand-rolled SCSS). `vite-plugin-pwa` for installability.

**Packages** — deps: `vue`, `pinia`. devDeps: `typescript`, `vite`, `@vitejs/plugin-vue`, `vite-plugin-pwa`, `vue-tsc`, `sass`, `vitest`, `@vue/test-utils`, `jsdom`, `eslint`, `eslint-plugin-vue`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`. **Explicitly not installed**: `vue-router`, `bootstrap`, `bootstrap-vue`, `axios`, `moment`, `lodash`, `uuid` (native `crypto.randomUUID()` instead).

**game-engine rules**: All code under `src/game-engine/` is pure TypeScript with **zero imports from `vue` or `pinia`**. Every module has a colocated `*.spec.ts`. Any function using randomness takes an injected `rng: () => number` parameter — never `Math.random()` directly inside game-engine logic. All tunable numeric constants live in `src/game-engine/constants/tuning.ts` (plus `difficulty.ts`, `milestones.ts`).

**Confirmed product decisions**:
- Streak milestone EXP (5/10/20/30/50/100) re-fires every time a streak count crosses that threshold again after a reset — not gated to once-per-habit-lifetime.
- On player death: character (stats/level/exp) resets fresh, boss resets to index 1, existing habit **definitions** (name, period, difficulty) are **kept**, but each habit's damage type is **re-rolled**, and every habit's streak resets to 0.
- Habit damage type is randomly assigned at creation time (and re-rolled on death) — never user-chosen. Distribution: physical 40%, magic 40%, healing 20%.
- Boss "personality" is randomly chosen at generation time from 5 equally-weighted options: `balanced`, `tank`, `armored`, `warded`, `brute`.

**Reference formulas pulled from Habitica** (`/Users/ryan.clode/sn/person/habitica/website/common/script`) — for context only, not literally reused: leveling curve in `statHelpers.js`; streak-based linear multiplier pattern in `scoreTask.js` (`1 + streak/100`); difficulty priority multipliers `[0.1, 1, 1.5, 2]` reused as the *weight* in this project's damage-split formula.

**Full exact constant values** (all live in `src/game-engine/constants/`):
```ts
// tuning.ts
BASE_STATS = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 }
STAT_RANDOMIZATION_PCT = 0.05        // ±5% at character creation
LEVEL_STAT_GROWTH_RATE = 0.06        // +6% compounding per level
STREAK_MULTIPLIER_PER_COUNT = 0.01   // +1% damage per streak count
BASE_BOSS_POWER = 80
BOSS_GROWTH_RATE = 1.22              // boss power ×1.22 per boss index
BOSS_STAT_SHARE = { health: 0.40, physicalAttack: 0.20, magicAttack: 0.20, armor: 0.10, magicResist: 0.10 }  // sums to 1
PERSONALITY_EMPHASIS_FACTOR = 2.0
RESIST_K = 50                        // diminishing-returns constant
BASE_BOSS_EXP = 40
BOSS_EXP_GROWTH_RATE = 1.18
MISS_DAMAGE_FACTOR = 0.5
HABIT_DAMAGE_TYPE_WEIGHTS = { physical: 0.4, magic: 0.4, healing: 0.2 }
BOSS_PERSONALITY_WEIGHTS = { balanced: 0.2, tank: 0.2, armored: 0.2, warded: 0.2, brute: 0.2 }

// difficulty.ts
DIFFICULTY_WEIGHT = { easy: 1, medium: 1.5, hard: 2 }

// milestones.ts
MILESTONES = [5, 10, 20, 30, 50, 100]
MILESTONE_EXP = { 5: 20, 10: 50, 20: 120, 30: 220, 50: 450, 100: 1200 }
```

**Project structure** (as built):
```
src/
  game-engine/
    constants/{tuning.ts, difficulty.ts, milestones.ts}
    types.ts  rng.ts  time.ts  leveling.ts  character.ts  habits.ts  streaks.ts  boss.ts  combat.ts  index.ts
    (+ colocated *.spec.ts per module)
  store/
    index.ts  characterStore.ts  bossStore.ts  habitStore.ts  debugClockStore.ts
    plugins/{saveState.ts, localStoragePersistence.ts}
  composables/{useCombatActions.ts, useDailyRollover.ts}
  components/
    layout/AppShell.vue
    character/{CharacterPanel.vue, CharacterStatsModal.vue}
    boss/{BossPanel.vue, BossStatsModal.vue}
    habits/{HabitList.vue, HabitListItem.vue, HabitStatsModal.vue, AddHabitForm.vue}
    ui/{Sprite.vue, Modal.vue, HealthBar.vue, ExpBar.vue}
    debug/{SkipDayButton.vue}
  assets/scss/{_variables.scss, _mixins.scss, main.scss}
  App.vue  main.ts
public/sprites/{player-placeholder.png, boss-placeholder.png}
```
`Character`/`Boss` types leave room for a future `equippedItems`/`lootTable` field (a `// TODO: items` comment only, not implemented) so items don't force a restructure later.

## Game-engine formulas (as implemented)

**Leveling**: `expToNextLevel(level)`: `level<5 ? 25*level : level===5 ? 150 : round(((level^2*0.25+10*level+139.75))/10)*10`. `statAtLevel(starterStatValue, level) = starterStatValue * (1 + LEVEL_STAT_GROWTH_RATE)^(level-1)`.

**Character creation**: each base stat randomized ±5% (`STAT_RANDOMIZATION_PCT`) via `randomizeStat`.

**Habit damage-split** (core balancing formula): for damage type T with base stat `S` and habits `H` of that type, each with difficulty weight `w_i`: `d_i = S * (w_i / Σ w_j)`. Verified against the spec's own example: 5 easy same-type habits, `S=100` → each deals exactly 20.

**Streaks**: `streakMultiplier(count) = 1 + count * STREAK_MULTIPLIER_PER_COUNT`. Milestone EXP re-fires every crossing (no once-per-lifetime gating).

**Boss generation/scaling**: `bossPowerBudget(index) = BASE_BOSS_POWER * BOSS_GROWTH_RATE^(index-1)`. Budget split across `{health, physicalAttack, magicAttack, armor, magicResist}` by fixed shares; a random personality doubles (`PERSONALITY_EMPHASIS_FACTOR`) its stat's share before normalizing. `bossExpReward(index) = BASE_BOSS_EXP * BOSS_EXP_GROWTH_RATE^(index-1)`.

**Resistance formula** (critical correctness detail): `damageReductionPct = resist / (resist + RESIST_K)` — stays strictly in `[0,1)` no matter how large resist grows, so bosses can never become mathematically unkillable as they scale forever.

**Combat resolution**: completing a habit computes its live damage-split share × streak multiplier; physical/magic passes through the boss's matching resist before subtracting from boss HP; healing heals the player (capped at max health). Missing a habit resets streak and damages the player via `avgAttack * MISS_DAMAGE_FACTOR * (difficultyWeight/1.5)`. Boss HP ≤ 0 → grant EXP, advance to next boss. Player HP ≤ 0 → fresh character, boss reset to index 1, habits kept with re-rolled damage type and reset streaks.

## Testing

Vitest, colocated `*.spec.ts` per `game-engine/*.ts` module, deterministic seeded RNG injectable via `rng.ts`. Key cases: leveling curve exact values + multi-level-up rollover; character stat randomization within ±5%; damage-split reproduces the spec's worked example exactly; streak multiplier/milestone values; boss power budget exponential values + resist-curve regression test (stays in `[0,1)` for very large resist); combat resolution and full death/reset flow.
