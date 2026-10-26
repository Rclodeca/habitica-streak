# Streak Ranks and Boss Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skills earn permanent ranks at streak milestones and hit for `1 + rank + 1% per streak day`, every skill hits for its type's full stat (no pools), boss HP grows in slower bands, and EXP comes from a share of a level per kill plus daily/weekly skill shares, with a one-time migration for the run in progress.

**Architecture:** Rank math lives in `src/game-engine/streaks.ts` beside the streak code; per-skill base damage (difficulty and crowding) replaces `computeDamageSplit` in `habits.ts`. `combat.ts` takes the full habit list instead of a pool. Boss bands and the kill reward live in `boss.ts`, skill EXP in `leveling.ts`. One engine function, `applyRankRebalance`, rescales the saved character and boss once, wired in `store/index.ts`. The UI work is the skill row (rank diamonds, rank-up flare), the skill modal (rank block, Rank/Streak lines, crowded Base, delete lock) and one log entry.

**Tech Stack:** Vue 3 + TypeScript + Pinia + SCSS, Vitest (`npm run test:unit`), `vue-tsc` via `npm run build` (it type-checks the spec files too).

**Spec:** `docs/superpowers/specs/2026-10-26-streak-ranks-and-boss-scaling-design.md`. Mockups (Ashen): `docs/mockups/skill-ranks.html` (round 1, rank-up option **2**), `skill-ranks-2.html` (one-line diamonds, modal layout **A**), `skill-ranks-3.html` (crowded option **A**, Ash), `skill-ranks-4.html` (difficulty option **A**, Word).

## Global Constraints

- Build directly on `main`. Commit after each task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before each commit: `npm run test:unit` and `npm run build` both pass. Baseline: 51 files, 840 tests passing. Existing tests whose numbers change under the new formulas get their assertions updated to the new math, not deleted, unless the thing they test is removed (pool math, `streakMultiplier`, `bossExpReward(index)`).
- Pure logic in `src/game-engine/`; stores stay thin; components never touch `localStorage`. New `Habit`/`Character` fields are optional so old saves load. An undefined `rank` reads as 0 everywhere.
- Values, verbatim from the spec:
  - Rank milestones: daily `10, 20, 30, 50, 100, 200, 300, 500`; weekly (in weeks) `3, 7, 10, 17, 33, 67, 100, 167` → ranks 1–8.
  - Hit multiplier `1 + RANK_BONUS × rank + STREAK_BONUS × streakCount`: `RANK_BONUS 1.0` (healing `0.25`), `STREAK_BONUS 0.01` daily, `0.03` weekly. Uses rank and streak before this completion bumps them.
  - `BASE_STATS: { physicalDamage: 336, magicDamage: 336, healing: 188, health: 1250, trueDamage: 288 }`.
  - Difficulty factor `DIFFICULTY_WEIGHT / 1.5`: easy ×2/3, medium ×1, hard ×4/3.
  - Crowding by creation order: the 15 oldest owned skills ×1, then ×0.7, ×0.5, ×0.35, and ×0.25 for every later one.
  - Heal cap: at most `ceil(skills / 4)` healing skills, on new rolls only.
  - `BOSS_HEALTH_GROWTH_BANDS: [[1, 1.27], [13, 1.17], [31, 1.11], [51, 1.09]]`.
  - Boss kill: `max(33, expToNextLevel(level) × 0.4 × (1 ± 10%))`. Daily skills share `0.2` of a level per day, weeklies `0.3` per week.
  - `QUEST_SLOT_WEIGHTS: [100, 100, 100, 100, 100, 60, 35, 20, 10, 5, 2]`.
  - `EXPECTED_LEVEL_BY_BOSS_INDEX: [1, 1], [5, 4], [10, 7], [15, 11], [20, 15], [25, 20], [30, 25], [40, 38], [50, 49]`.
  - Migration: physical, magic and true damage ×0.6; boss HP × `newBase(index) / oldBase(index)` (old = `650 × 1.27^(index−1)`).
- Unchanged: miss damage, crits, lifesteal, boss skills, milestone EXP (`MILESTONES` still re-fire), `QUEST_DIFFICULTY_MULT`, `WEEKLY_BONUS_MULTIPLIER`, `MAX_LEVEL_UPS_PER_GRANT`.
- Never protect a streak: a miss still drops it to 0. Nothing ever lowers a rank (miss, death, Reroll skill, the death reset of Special/Ult/Overdrive).
- Copy stays terse: a rank numeral ("Rank V"), "Unranked", "crowded", "Tomorrow". No explanations.
- Mobile first: no new tap targets under 44px; the flare animates only `transform`/`opacity`, plays once, and respects `prefers-reduced-motion`.
- Both themes: component scoped styles are the Minimalist base; Ashen restyles go in `src/assets/scss/themes/ashen.scss` under `:root[data-theme='ashen']`, matching the mockup CSS.
- Rewrite any comment the change makes stale (pools, the 0.10 streak bonus, the "EXP growth must stay below boss growth" rule).

**Decisions this plan makes** (the spec left them to the builder):
- TUNING names as given in each task. Rank-up happens in `completeHabitStreak`. The one-time flag is `Character.rankRebalanceApplied`.
- Rank stays out of the high-score snapshot. Old records are left alone.
- Skill EXP isn't shown in the log; skill entries keep showing milestone EXP only.
- The daily-EXP split counts the dailies due on the day the reward resolves (today), plus the skill itself if it isn't due today, so a rollover resolution never divides by zero.
- Difficulty pips go from every skill surface (row, Reroll row, modal, add-skill form, missed-skills popup). Quest cards keep theirs: quests have no rank.

## Review Focus

1. **An old save reloaded right after the migration** (load, close, load again): stats and boss HP scale exactly once. → Task 4, store test.
2. **A ranked skill rebuilding after a miss** (rank III, streak back through 10, 20, 30): no rank-up, no log line, no flare; at 50 it goes to IV once. → Task 1 and Task 8.
3. **Overdrive uses:** no streak bump, no rank-up, no skill EXP. → Task 3 and Task 5.
4. **A set-day bad daily resolved by the rollover on a day it isn't due**, or with every other daily resting: skill EXP stays finite and counts the skill itself. → Task 5.
5. **Deleting one of the 15 oldest skills:** the 16th skill hits in full at once, and no other skill's number changes. → Task 2.

---

### Task 1: Rank engine

**Files:**
- Modify: `src/game-engine/types.ts` (`Habit.rank?: number`, `Habit.createdDayKey?: string`, each with a one-line comment; undefined rank = 0, undefined createdDayKey = removable)
- Modify: `src/game-engine/constants/tuning.ts` (add the rank keys below; import `Period` from `../types`)
- Modify: `src/game-engine/streaks.ts`, `src/game-engine/habits.ts` (`createHabit` sets `rank: 0`), `src/store/habitStore.ts` (`initFromSave`), `src/game-engine/index.ts`
- Test: `src/game-engine/streaks.spec.ts`, `src/game-engine/habits.spec.ts`, `src/store/habitStore.spec.ts`

**Interfaces:**
- Produces (all in `streaks.ts`, exported from the barrel):
  - `rankForStreak(streakCount: number, period: Period): number`: how many of the period's milestones `streakCount` has reached (0–8).
  - `nextRankMilestone(rank: number, period: Period): number | undefined`: the streak for `rank + 1`; undefined at rank 8.
  - `rankBonus(habit: Habit): number`: `(rank ?? 0) × RANK_BONUS`, or `HEAL_RANK_BONUS` for healing.
  - `streakBonus(habit: Habit): number`: `streakCount × STREAK_BONUS`, or `WEEKLY_STREAK_BONUS` for a weekly.
  - `rankMultiplier(habit: Habit): number`: `1 + rankBonus + streakBonus`.
  - `completeHabitStreak(habit)` → `{ habit, milestoneExp }` where `habit.rank = max(rank ?? 0, rankForStreak(newStreak, period))`.
  - `migrateHabitRank(habit: Habit): Habit`: fills a missing `rank` with `rankForStreak(streakCount, period)`; a habit that has one comes back unchanged.
- TUNING: `RANK_MILESTONES: { daily: [10, 20, 30, 50, 100, 200, 300, 500], weekly: [3, 7, 10, 17, 33, 67, 100, 167] }`, `RANK_BONUS: 1.0`, `HEAL_RANK_BONUS: 0.25`, `STREAK_BONUS: 0.01`, `WEEKLY_STREAK_BONUS: 0.03`. Leave `streakMultiplier` and its TUNING keys in place; Task 3 removes them.

- [ ] **Step 1: Write the failing tests** in `streaks.spec.ts`:

```ts
it('counts reached milestones per period', () => {
  expect([9, 10, 49, 50, 500, 9999].map((s) => rankForStreak(s, 'daily'))).toEqual([0, 1, 3, 4, 8, 8]);
  expect([2, 3, 9, 10, 167].map((s) => rankForStreak(s, 'weekly'))).toEqual([0, 1, 2, 3, 8]);
});
it('names the next milestone, none past rank 8', () => {
  expect(nextRankMilestone(0, 'daily')).toBe(10);
  expect(nextRankMilestone(5, 'daily')).toBe(200);
  expect(nextRankMilestone(2, 'weekly')).toBe(10);
  expect(nextRankMilestone(8, 'daily')).toBeUndefined();
});
it('ranks up on reaching the next milestone, and only then', () => {
  expect(completeHabitStreak(makeHabit({ streakCount: 9, rank: 0 })).habit.rank).toBe(1);
  expect(completeHabitStreak(makeHabit({ streakCount: 49, rank: 3 })).habit.rank).toBe(4);
  expect(completeHabitStreak(makeHabit({ streakCount: 2, period: 'weekly' })).habit.rank).toBe(1);
  expect(completeHabitStreak(makeHabit({ streakCount: 599, rank: 8 })).habit.rank).toBe(8);
});
it('a rank III skill rebuilding after a miss keeps rank III through 10, 20 and 30', () => {
  for (const s of [9, 19, 29]) expect(completeHabitStreak(makeHabit({ streakCount: s, rank: 3 })).habit.rank).toBe(3);
});
it('a miss resets the streak but never the rank', () => {
  expect(resetHabitStreak(makeHabit({ streakCount: 40, rank: 3 }))).toMatchObject({ streakCount: 0, rank: 3 });
});
it('multiplies by 1 + rank + 1% a day (healing +25% a rank, weeklies 3% a week)', () => {
  expect(rankMultiplier(makeHabit({ rank: 5, streakCount: 112 }))).toBeCloseTo(7.12);
  expect(rankMultiplier(makeHabit({ rank: 8, streakCount: 500 }))).toBeCloseTo(14);
  expect(rankMultiplier(makeHabit({ rank: 2, streakCount: 23, damageType: 'healing' }))).toBeCloseTo(1.73);
  expect(rankMultiplier(makeHabit({ rank: 2, streakCount: 9, period: 'weekly' }))).toBeCloseTo(3.27);
  expect(rankMultiplier(makeHabit({ streakCount: 0 }))).toBe(1); // no rank field
});
it('migrates a missing rank from the current streak, and only a missing one', () => {
  expect(migrateHabitRank(makeHabit({ streakCount: 34 })).rank).toBe(3);
  expect(migrateHabitRank(makeHabit({ streakCount: 12, period: 'weekly' })).rank).toBe(3);
  const ranked = makeHabit({ streakCount: 50, rank: 2 });
  expect(migrateHabitRank(ranked)).toBe(ranked);
});
```

Add to `habits.spec.ts`: `createHabit(...)` returns `rank: 0`. Add to `habitStore.spec.ts`: `initFromSave` on a saved daily with `streakCount: 21` and no `rank` gives `rank: 2`.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine/streaks.spec.ts src/game-engine/habits.spec.ts src/store/habitStore.spec.ts`. Expected: FAIL, `rankForStreak` etc. not exported.

- [ ] **Step 3: Implement** the Interfaces above. `habitStore.initFromSave` maps `migrateHabitRank(migrateHabitDamageType(habit, rng))`. The ranks the migration fills get no log entries.

- [ ] **Step 4: Run the tests, then the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "Add skill ranks earned at streak milestones"`

---

### Task 2: No damage pools

**Files:**
- Modify: `src/game-engine/habits.ts` (delete `computeDamageSplit`, `poolSizeMultiplier`, `dueFraction`; add the three functions below)
- Modify: `src/game-engine/constants/tuning.ts` (`BASE_STATS` new values; delete `POOL_GROWTH_PER_MEDIUM_HABIT`; add `FULL_POWER_SKILLS: 15`, `CROWDED_SKILL_FACTORS: [0.7, 0.5, 0.35, 0.25]`; replace the `BASE_STATS` history comment with a short one: per-skill stats, no pools, 60% of the old pooled values, 8 skills is the reference loadout, sim `SKILLS=8 POOLS=0 node scripts/balance-sim.mjs`)
- Modify: `src/game-engine/combat.ts` (`habitDamageBreakdown`, `completeHabit`, `resolveCompletion`, `overdriveHabit`, `expectedMediumDailyDamage`, and their doc comments)
- Modify: `src/store/habitStore.ts` (delete the `habitsOfType` getter), `src/store/characterStore.ts` (`completeHabit` wrapper's param is `allHabits`)
- Modify callers to pass `habitStore.habits`: `src/composables/useCombatActions.ts:166`, `src/components/habits/HabitListItem.vue:42-45`, `HabitStatsModal.vue:38-41`, `RerollSkillRow.vue:24-28`; `src/components/character/CharacterPanel.vue:133-148` (call `expectedMediumDailyDamage(character.value, type)`, drop the pool comment)
- Modify: `src/game-engine/index.ts`
- Test: `src/game-engine/habits.spec.ts`, `src/game-engine/combat.spec.ts`, `src/game-engine/character.spec.ts`, `src/store/habitStore.spec.ts`

**Interfaces:**
- Produces (in `habits.ts`, exported):
  - `difficultyFactor(difficulty: Difficulty): number`: `DIFFICULTY_WEIGHT[d] / DIFFICULTY_WEIGHT.medium`.
  - `crowdingFactor(habit: Habit, allHabits: Habit[]): number`: the habit's index in `allHabits` (a habit not in the list counts as `allHabits.length`, i.e. a skill about to be added); 1 below `FULL_POWER_SKILLS`, then `CROWDED_SKILL_FACTORS[i − 15]`, with the last factor for every later index.
  - `skillBaseDamage(habit: Habit, allHabits: Habit[], statValue: number): number`: `statValue × difficultyFactor × crowdingFactor`.
- Changes (in `combat.ts`): the third parameter of `habitDamageBreakdown`, `completeHabit` and `overdriveHabit` becomes `allHabits: Habit[]`, every owned habit in store order. `HabitDamageBreakdown` gains `crowded: boolean` (crowding factor < 1). `expectedMediumDailyDamage(character: Character, damageType: DamageType): number` is the raw stat (level and flat items) × the item multiplier: what a medium rank-0, streak-0 skill hits for.
- `habitsOfType` is gone; nothing else reads it.

- [ ] **Step 1: Write the failing tests.** In `habits.spec.ts`, replace the `computeDamageSplit`/`poolSizeMultiplier`/`dueFraction` tests with:

```ts
it('weights difficulty around medium', () => {
  expect(difficultyFactor('easy')).toBeCloseTo(2 / 3);
  expect(difficultyFactor('medium')).toBe(1);
  expect(difficultyFactor('hard')).toBeCloseTo(4 / 3);
});
it('crowds only the newest skills past 15', () => {
  const habits = Array.from({ length: 20 }, (_, i) => makeHabit({ id: `h${i}` }));
  expect(habits.map((h) => crowdingFactor(h, habits))).toEqual([...Array(15).fill(1), 0.7, 0.5, 0.35, 0.25, 0.25]);
  expect(crowdingFactor(makeHabit({ id: 'new' }), habits.slice(0, 15))).toBe(0.7);
});
it('deleting one of the 15 oldest moves the 16th up to full power', () => {
  const habits = Array.from({ length: 16 }, (_, i) => makeHabit({ id: `h${i}` }));
  const after = habits.filter((h) => h.id !== 'h3');
  expect(crowdingFactor(habits[15], after)).toBe(1);
  expect(after.slice(0, 14).map((h) => crowdingFactor(h, after))).toEqual(Array(14).fill(1));
});
```

In `combat.spec.ts`, change `makeHabit`'s default `difficulty` to `'medium'`, then add (boss `armor: 0`, `noCritRng`):
- two medium physical skills each hit for the full `physicalDamage` stat: `completeHabit(c, h1, [h1, h2], ...)` deals the same as `[h1]`;
- a hard skill deals 4/3 of a medium one, an easy one 2/3;
- a set-day daily on a due day hits like a plain daily;
- the 16th skill in the list deals 0.7× the first, its breakdown has `crowded: true`, the first's `crowded: false`, and adding that 16th leaves the first skill's `effectiveDamage` unchanged;
- a crowded (16th) healing skill heals 0.7× a full one;
- `expectedMediumDailyDamage(character, 'physical')` equals `statAtLevel(physicalDamage, level) × itemStatMultiplier(...)` whatever habits exist.

In `character.spec.ts`: `createCharacter`'s physical + magic is within ±5% of 672, and `trueDamage` within ±5% of 288.

Then update the existing `combat.spec.ts` expectations that assumed pooled shares to the new base. Delete tests of the removed functions only.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine`. Expected: FAIL on the new tests, with `difficultyFactor`, `crowdingFactor` not exported.

- [ ] **Step 3: Implement** the Interfaces above, update the callers listed in Files, and delete `habitsOfType` and the dead exports.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS, with no `habitsOfType`, `computeDamageSplit` or `poolSizeMultiplier` left (`grep -rn "habitsOfType\|computeDamageSplit\|poolSizeMultiplier\|dueFraction" src` prints nothing).

- [ ] **Step 5: Commit.** `git commit -m "Hit for each skill's full stat instead of splitting damage pools"`

---

### Task 3: Rank multiplier in hits

**Files:**
- Modify: `src/game-engine/combat.ts` (`resolveCompletion` uses `rankMultiplier(habit)` on the pre-completion habit; `habitDamageBreakdown` and its type)
- Modify: `src/game-engine/streaks.ts` (delete `streakMultiplier`), `src/game-engine/constants/tuning.ts` (delete `STREAK_MULTIPLIER_PER_COUNT`, `WEEKLY_STREAK_MULTIPLIER_PER_COUNT`), `src/game-engine/index.ts`
- Modify: `src/components/habits/HabitStatsModal.vue:45,84` (read `rankMultiplier` where it read `streakMultiplier`; Task 9 redoes these rows)
- Test: `src/game-engine/combat.spec.ts`, `src/game-engine/streaks.spec.ts`

**Interfaces:**
- Consumes: `rankBonus`, `streakBonus`, `rankMultiplier` (Task 1); `skillBaseDamage` (Task 2).
- Produces: `HabitDamageBreakdown` loses `streakMultiplier` and gains `rankBonus: number` (e.g. 5 for +500%), `streakBonus: number` (e.g. 1.12), `rankMultiplier: number` (1 + both). `effectiveDamage = baseDamage × itemMultiplier × rankMultiplier × weeklyMultiplier × bonusMultiplier × effectMultiplier`.

- [ ] **Step 1: Write the failing tests** in `combat.spec.ts` (medium skills, boss `armor: 0`, `magicResist: 0`, `noCritRng`; `S` = the character's level-1 stat):
- rank 3, streak 29 physical deals `S × 4.29`; `updatedHabit` is streak 30, rank 3;
- rank 0, streak 9 deals `S × 1.09` (the pre-completion rank), and `updatedHabit.rank` is 1;
- a rank 4, streak 0 healing skill heals `S × 2` (start the character at 1 HP so the max-health cap doesn't hide it);
- a weekly rank 1, streak 3 deals `S × 2.09 × TUNING.WEEKLY_BONUS_MULTIPLIER`;
- `overdriveHabit` on a streak 9, rank 0 skill leaves `streakCount` 9 and `rank` 0;
- `habitDamageBreakdown` for rank 5, streak 112 gives `rankBonus` 5, `streakBonus` 1.12, `rankMultiplier` 7.12.

Delete the `streakMultiplier` tests in `streaks.spec.ts` and update any `combat.spec.ts` expectation built on the 0.10-a-day bonus.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine/combat.spec.ts`. Expected: FAIL, damage still uses `1 + 0.1 × streak`.

- [ ] **Step 3: Implement** the Interfaces above.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS; `grep -rn "streakMultiplier\|STREAK_MULTIPLIER_PER_COUNT" src` prints nothing.

- [ ] **Step 5: Commit.** `git commit -m "Scale hits by rank and streak instead of the old streak bonus"`

---

### Task 4: Boss HP bands and the one-time rebalance

**Files:**
- Modify: `src/game-engine/constants/tuning.ts` (delete `BOSS_HEALTH_GROWTH_RATE`; add `BOSS_HEALTH_GROWTH_BANDS`, `ONE_TIME_RANK_REBALANCE_DAMAGE_FACTOR: 0.6`, `LEGACY_BOSS_HEALTH_GROWTH_RATE: 1.27`)
- Modify: `src/game-engine/boss.ts` (`bossBaseHealth`, new functions below)
- Modify: `src/game-engine/types.ts` (`Character.rankRebalanceApplied?: boolean`, commented like `damagePoolRebalanceApplied`)
- Modify: `src/game-engine/character.ts` (`applyRankRebalance`; `createCharacter` sets `rankRebalanceApplied: true`)
- Modify: `src/store/index.ts` (apply it after the `initFromSave` calls, before `migrateEventState`; extend the comment's migration list)
- Modify: `src/game-engine/index.ts`
- Test: `src/game-engine/boss.spec.ts`, `src/game-engine/character.spec.ts`, `src/store/index.spec.ts`

**Interfaces:**
- Produces:
  - `bossHealthGrowthRate(index: number): number` (`boss.ts`): the rate of the last band row whose start is ≤ `index`, i.e. the step from boss `index − 1` to `index`.
  - `bossBaseHealth(index, difficultyModifier = 1)`: `BASE_BOSS_HEALTH × Π bossHealthGrowthRate(k) for k = 2..index × difficultyModifier`.
  - `rescaleBossToHealthBands(boss: Boss): Boss` (`boss.ts`): `health` and `maxHealth` × `bossBaseHealth(index) / (BASE_BOSS_HEALTH × LEGACY_BOSS_HEALTH_GROWTH_RATE^(index − 1))`. Every other field is untouched.
  - `applyRankRebalance(character: Character, boss: Boss): { character: Character; boss: Boss }` (`character.ts`): returns both unchanged when `rankRebalanceApplied`; otherwise `physicalDamage`, `magicDamage`, `trueDamage` × 0.6 (healing and health untouched), the flag set, and the boss rescaled.
- `BOSS_HEALTH_GROWTH_BANDS` comment: each row's rate applies from that boss on; ×1.15 was the first pick for 13+, ×1.16 is the in-between if ×1.17 drags; **every band must stay well above ~×1.05**, or kill EXP (`BOSS_KILL_LEVEL_SHARE`, Task 5) can buy levels faster than bosses grow. This replaces the old "EXP growth below boss growth" rule.

- [ ] **Step 1: Write the failing tests.** `boss.spec.ts`:

```ts
it('grows boss HP in bands', () => {
  const expected: [number, number][] = [[1, 650], [10, 5586.591], [12, 9010.612], [13, 10542.416], [15, 14431.513],
    [20, 31640.343], [30, 152089.698], [31, 168819.565], [40, 431846.681], [60, 2902848.388]];
  for (const [index, hp] of expected) expect(bossBaseHealth(index)).toBeCloseTo(hp, 2);
  expect(bossBaseHealth(100) / 91176784.359).toBeCloseTo(1, 6);
  expect(bossBaseHealth(20, 1.1)).toBeCloseTo(31640.343 * 1.1, 2);
});
it('keeps every band rising faster than kills can level', () => {
  const bands = TUNING.BOSS_HEALTH_GROWTH_BANDS;
  expect(bands[0][0]).toBe(1);
  expect(bands.every(([, rate]) => rate > 1.05)).toBe(true);
});
it('rescales a saved boss to the bands, keeping its HP percent', () => {
  const boss = { ...generateBoss(24, createRng(3)), maxHealth: 170000, health: 85000 };
  const out = rescaleBossToHealthBands(boss);
  expect(out.maxHealth).toBeCloseTo(170000 * 0.373754, 0);
  expect(out.health / out.maxHealth).toBeCloseTo(0.5);
  expect({ ...out, health: 0, maxHealth: 0 }).toEqual({ ...boss, health: 0, maxHealth: 0 });
  const early = generateBoss(12, createRng(4));
  expect(rescaleBossToHealthBands(early).maxHealth).toBeCloseTo(early.maxHealth);
});
```

`character.spec.ts`: an unflagged character → physical, magic, true ×0.6, healing and health equal, flag true, boss rescaled; a flagged one → `toBe` the same character and boss objects; `createCharacter(...).rankRebalanceApplied` is true.

`store/index.spec.ts`, modeled on the `applyDamagePoolRebalance` persistence test: save a character with `rankRebalanceApplied: undefined` and a boss at index 24, `initializeStores()`, advance 300ms, and check the persisted stats are ×0.6 and the boss `maxHealth` rescaled. Then `setActivePinia(createPinia())`, `initializeStores()` again from that saved state, advance 300ms, and check nothing scaled a second time.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine/boss.spec.ts src/game-engine/character.spec.ts src/store/index.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces above. In `initializeStores`:

```ts
const rebalanced = applyRankRebalance(characterStore.character, bossStore.boss);
characterStore.setCharacter(rebalanced.character);
bossStore.setBoss(rebalanced.boss);
```

Update the existing `boss.spec.ts` tests that read `BOSS_HEALTH_GROWTH_RATE`.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "Grow boss health in slower bands and rescale the run in progress"`

---

### Task 5: EXP from kills, skills and quests

**Files:**
- Modify: `src/game-engine/constants/tuning.ts` (delete `BASE_BOSS_EXP`, `BOSS_EXP_GROWTH_RATE` and their comments; add `BOSS_KILL_LEVEL_SHARE: 0.4`, `BOSS_KILL_EXP_JITTER_PCT: 0.1`, `BOSS_KILL_MIN_EXP: 33`, `DAILY_SKILL_LEVEL_SHARE: 0.2`, `WEEKLY_SKILL_LEVEL_SHARE: 0.3`; set `QUEST_SLOT_WEIGHTS` and `EXPECTED_LEVEL_BY_BOSS_INDEX` to the spec values)
- Modify: `src/game-engine/boss.ts` (`bossExpReward`), `src/game-engine/combat.ts` (`resolveBossDefeatIfDead`), `src/game-engine/leveling.ts` (`skillCompletionExp`; rewrite the `MAX_LEVEL_UPS_PER_GRANT` comment: kill EXP now follows level, so the cap is only defense in depth)
- Modify: `src/composables/useCombatActions.ts` (`applyReward`; drop the `bossExpReward` import)
- Modify: `src/game-engine/index.ts`
- Test: `src/game-engine/boss.spec.ts`, `src/game-engine/combat.spec.ts`, `src/game-engine/leveling.spec.ts`, `src/game-engine/quests.spec.ts`, `src/composables/useCombatActions.spec.ts`

**Interfaces:**
- Produces:
  - `bossExpReward(level: number, rng: Rng): number`: `max(BOSS_KILL_MIN_EXP, expToNextLevel(level) × BOSS_KILL_LEVEL_SHARE × (1 + (rng() × 2 − 1) × BOSS_KILL_EXP_JITTER_PCT))`. One `rng()` per call.
  - `resolveBossDefeatIfDead(...)` also returns `expReward: number`: the pre-item EXP it granted at the slayer's level, 0 when the boss isn't dead. Roll it before `rollItemDrops`, since drop odds read the leveled character. Scripted-rng tests through this function need one extra leading value.
  - `skillCompletionExp(level: number, habit: Habit, habits: Habit[], date: Date): number` (`leveling.ts`): a weekly pays `expToNextLevel(level) × WEEKLY_SKILL_LEVEL_SHARE / (weekly habits in habits)`. A daily pays `expToNextLevel(level) × DAILY_SKILL_LEVEL_SHARE / (daily habits h with isDueOn(h, date) or h.id === habit.id)`. Good and bad skills count alike, and the divisor is never below 1.
- Comments: `BOSS_KILL_LEVEL_SHARE` explains the runaway margin (a kill adds `1.06^(share × (1 + EXP bonus))` of power; at 0.4 it takes about +270% EXP to match the deepest ×1.09 band) and why there's no kill-speed scaling. The ±10% keeps level-ups from feeling scheduled, and the floor keeps the opening kills as today. `EXPECTED_LEVEL_BY_BOSS_INDEX` points at `SKILLS=8 POOLS=0 KILL_SHARE=0.4 DAILY_EXP=0.2 KILL_FLOOR=33 TABLE=1 node scripts/balance-sim.mjs` instead of the 52-week sim. `QUEST_SLOT_WEIGHTS`: the first five quests a week each pay a full slot, and the hard ceiling is now 632.

- [ ] **Step 1: Write the failing tests.**
- `boss.spec.ts`: `bossExpReward(10, () => 0.5)` is 104; `() => 0` gives `93.6`; `() => 0.999999` ≈ 114.4; `bossExpReward(1, () => 0.5)` and `bossExpReward(3, () => 0.5)` are 33; `bossExpReward(20, () => 0.5)` is 176. `expectedLevelForBossIndex` gives 15 at 20, 25 at 30 and 49 at 50.
- `combat.spec.ts`: a level-10, 0-EXP character killing a boss (rng 0.5 for the jitter) gets `expReward` 104 and `exp` 104; a live boss gives `expReward` 0.
- `leveling.spec.ts` (level 10, so `expToNextLevel` is 260; add a `makeHabit` like `combat.spec.ts`'s, default medium daily):

```ts
const MONDAY = new Date('2026-10-26T20:00:00Z'); // a Monday in Pacific time, which dayOfWeekIndex reads
const TUESDAY_INDEX = 1;
it('splits a day of dailies into 20% of a level', () => {
  const dailies = Array.from({ length: 8 }, (_, i) => makeHabit({ id: `d${i}` }));
  expect(skillCompletionExp(10, dailies[0], dailies, MONDAY)).toBeCloseTo(6.5);
});
it('counts only the dailies due that day, plus the skill itself', () => {
  const due = Array.from({ length: 4 }, (_, i) => makeHabit({ id: `d${i}` }));
  const resting = Array.from({ length: 4 }, (_, i) => makeHabit({ id: `r${i}`, days: [TUESDAY_INDEX] }));
  expect(skillCompletionExp(10, due[0], [...due, ...resting], MONDAY)).toBeCloseTo(13);
  expect(skillCompletionExp(10, resting[0], [...due, ...resting], MONDAY)).toBeCloseTo(10.4);
  expect(skillCompletionExp(10, resting[0], resting, MONDAY)).toBeCloseTo(52);
});
it('splits a week of weeklies into 30% of a level, apart from the dailies', () => {
  const weeklies = Array.from({ length: 3 }, (_, i) => makeHabit({ id: `w${i}`, period: 'weekly' }));
  const daily = makeHabit({ id: 'd' });
  expect(skillCompletionExp(10, weeklies[0], [daily, ...weeklies], MONDAY)).toBeCloseTo(26);
  expect(skillCompletionExp(10, daily, [daily, ...weeklies], MONDAY)).toBeCloseTo(52);
});
```

- `quests.spec.ts`: `questSlotExp(10, 'medium', k)` is equal for `k` = 0–4, slot 5 is 60% of slot 0, slot 11 pays 0. Update the old 232-ceiling expectations.
- `useCombatActions.spec.ts`: checking off the only daily at level 1 raises `exp` by `expToNextLevel(1) × 0.2` (5) (boss HP high, no milestone); `activateOverdrive` on it afterwards leaves `exp` unchanged; a kill logs `boss-defeated` with the `expReward` the engine returned.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine src/composables/useCombatActions.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces above. In `applyReward`, a non-Overdrive reward grants `milestoneExp + skillCompletionExp(character.level, habit, habitStore.habits, debugClockStore.now())` in one `addExpAndResolveLevelUps` call (it already applies EXP items). The log's `milestoneExp` stays milestone only. The `boss-defeated` entry's `amount` is `defeatResult.expReward`.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS; `grep -rn "BASE_BOSS_EXP\|BOSS_EXP_GROWTH_RATE" src` prints nothing.

- [ ] **Step 5: Commit.** `git commit -m "Pay EXP as a share of a level for kills and daily and weekly skills"`

---

### Task 6: Heal-skill cap

**Files:**
- Modify: `src/game-engine/constants/tuning.ts` (`HEAL_SKILL_CAP_SHARE: 0.25`)
- Modify: `src/game-engine/habits.ts`, `src/game-engine/events.ts` (`applyRerollSkillEvent`), `src/game-engine/combat.ts` (`resolvePlayerDeathIfDead`), `src/store/habitStore.ts` (`addHabit`), `src/game-engine/index.ts`
- Test: `src/game-engine/habits.spec.ts`, `src/game-engine/events.spec.ts`, `src/game-engine/combat.spec.ts`, `src/store/habitStore.spec.ts`

**Interfaces:**
- Produces (in `habits.ts`):
  - `healingAllowed(otherHabits: Habit[], skillCount: number): boolean`: the healing skills among `otherHabits` are fewer than `Math.ceil(skillCount × HEAL_SKILL_CAP_SHARE)`.
  - `rerollDamageType(habit, rng, excludeCurrent = false, excludeHealing = false)`.
  - `createHabit(name, period, difficulty, isBad, rng, days?, isFirstHabit = false, excludeHealing = false)`.
  - `rerollAllDamageTypes(habits: Habit[], rng: Rng): Habit[]`: rerolls each habit in order and excludes healing once the habits rerolled so far fill the cap for `habits.length`. Order, ranks and streaks are kept.
- Wiring: `habitStore.addHabit` passes `excludeHealing = !healingAllowed(this.habits, this.habits.length + 1)`. `applyRerollSkillEvent` passes `!healingAllowed(habits without the target, habits.length)`. `resolvePlayerDeathIfDead` maps `rerollAllDamageTypes(habits, rng)` through `resetLevelRewards`. Existing heal skills over the cap are never touched outside a reroll.

- [ ] **Step 1: Write the failing tests.**
- `healingAllowed`: 3 others with none healing, count 4 → true; 3 others with 1 healing, count 4 → false; 4 with 1 healing, count 5 → true; 11 with 3 healing, count 12 → false; 12 with 3 healing, count 13 → true.
- For seeds 1–200: `createHabit(..., false, true)` and `rerollDamageType(h, rng, false, true)` never give healing.
- `applyRerollSkillEvent`: with 4 skills, one healing that isn't the target, the target never becomes healing over seeds 1–200. Its rank and streak are kept.
- `rerollAllDamageTypes` on 8 skills: never more than 2 healing over seeds 1–200; ids, order, `rank` and `streakCount` unchanged.
- `resolvePlayerDeathIfDead` keeps every habit's `rank`.
- `habitStore.addHabit` with 3 skills, one healing: the 4th never rolls healing over seeds 1–200. `initFromSave` with 3 healing skills among 4 keeps all 3.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine src/store/habitStore.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces above.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "Cap healing skills at one in four on new rolls"`

---

### Task 7: Delete lock

**Files:**
- Modify: `src/game-engine/habits.ts` (`removalLocked`), `src/game-engine/index.ts`
- Modify: `src/composables/useCombatActions.ts` (`addHabit` also stamps `createdDayKey: dailyPeriodKey(debugClockStore.now())`)
- Modify: `src/components/habits/HabitStatsModal.vue` (the remove section)
- Modify: `src/assets/scss/themes/ashen.scss` (locked remove: ash caps, italic "Tomorrow", per `skill-ranks-2.html` `.remove.locked`)
- Test: `src/game-engine/habits.spec.ts`, `src/composables/useCombatActions.spec.ts`, `src/components/habits/HabitStatsModal.spec.ts`

**Interfaces:**
- Produces: `removalLocked(habit: Habit, currentDayKey: string): boolean`: `habit.createdDayKey === currentDayKey`. A habit without `createdDayKey` is never locked.
- UI: while locked, the button stays visible but disabled, reading "Remove habit" with `<small>Tomorrow</small>`, and the confirm step can't open.

- [ ] **Step 1: Write the failing tests.** `removalLocked` is true for today's key, false for yesterday's and for no `createdDayKey`. `useCombatActions().addHabit(...)` returns a habit whose `createdDayKey` is today's `dailyPeriodKey`. In `HabitStatsModal.spec.ts`: a skill created today shows a disabled `.remove-button` containing "Tomorrow", and clicking it shows no confirm text. One with `createdDayKey` yesterday is enabled. Skipping a day on the debug clock (`useDebugClockStore()`) unlocks the first.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/game-engine/habits.spec.ts src/composables/useCombatActions.spec.ts src/components/habits/HabitStatsModal.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces above.

- [ ] **Step 4: Run the suite and build.** Run: `npm run test:unit && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "Lock a new skill's remove button until tomorrow"`

---

### Task 8: Rank on the skill row, and the rank-up moment

**Files:**
- Create: `src/components/habits/RankDiamonds.vue`
- Modify: `src/components/habits/habitDisplay.ts` (`rankNumeral`)
- Modify: `src/components/habits/HabitListItem.vue` (pips → diamonds; the flare), `RerollSkillRow.vue` (pips → diamonds; fix its header comment), `src/components/ui/MissedSkillsPopup.vue` (drop the pips and `PIPS`), `src/components/habits/AddHabitModal.vue` (drop the option pips and the `pips` field; labels stay)
- Modify: `src/store/activityLogStore.ts`, `src/components/ui/ActivityLog.vue`, `src/composables/useCombatActions.ts` (`applyReward`)
- Modify: `src/assets/scss/themes/ashen.scss` (gold diamonds per `skill-ranks-2.html` `.rk i`; flare per `skill-ranks.html` `.flare` / `.ghost`; drop rules for the removed pips)
- Test: `src/components/habits/HabitListItem.spec.ts`, `src/components/ui/ActivityLog.spec.ts`, `src/composables/useCombatActions.spec.ts`, `src/components/habits/AddHabitModal.spec.ts`

**Interfaces:**
- Consumes: `Habit.rank` (Task 1).
- Produces:
  - `rankNumeral(rank: number): string`: `''` for 0, then `I`–`VIII`.
  - `RankDiamonds.vue`, props `{ rank: number }`: renders nothing at rank 0. Otherwise it renders a `span.rank-diamonds` with `role="img"`, an `aria-label` of "Rank " plus `rankNumeral(rank)`, and `rank` `<i>` diamonds on one line. Minimalist base: 6px `--accent` squares rotated 45°, 1.5px apart.
  - Log entry `{ kind: 'rank-up'; habitName: string; rank: number }`, rendered as `<StatIcon name="streak" class="log-icon" /> "{{ habitName }}" · Rank {{ rankNumeral(rank) }}`.
- Rank-up detection: `applyReward` adds the `rank-up` entry right after the skill's own entry when `(result.updatedHabit.rank ?? 0) > (habit.rank ?? 0)`.
- Flare: `HabitListItem` watches `props.habit.rank ?? 0`. On an increase it sets `flareRank` and adds class `flare` to the row, with `<span class="rank-ghost" aria-hidden="true">Rank {{ numeral }}</span>`, then clears both after `RANK_FLARE_MS = 2400` (timer cleared on unmount). It plays once: the sweep runs 1.1s on `.habit-item.flare::after`, and the ghost rises over the full 2.4s, `transform`/`opacity` only. Under `prefers-reduced-motion` there's no sweep and the ghost shows still. Mounting with a rank, or a streak-only change, plays nothing.

- [ ] **Step 1: Write the failing tests.**
- `HabitListItem.spec.ts`: rank 0 renders no `.rank-diamonds`; rank 3 renders 3 `.rank-diamonds i` with label "Rank III"; no `.pips` anywhere. With fake timers, changing the store habit's rank 2 → 3 gives the row class `flare` and `.rank-ghost` text "Rank III", and after 2400ms both are gone. Changing only `streakCount` gives no `flare`, and neither does mounting at rank 5.
- `useCombatActions.spec.ts` (boss HP 1e9): checking off a streak-9, rank-0 skill puts `{ kind: 'rank-up', habitName, rank: 1 }` at `entries[0]`, above its `skill-damage` entry. A rank-3, streak-29 skill adds no `rank-up` entry. A streak-49, rank-3 skill logs rank 4.
- `ActivityLog.spec.ts`: a `rank-up` entry for "Run" at rank 5 reads `"Run" · Rank V`.
- `AddHabitModal.spec.ts`: the difficulty options show Easy/Medium/Hard and no `.pip`.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/components src/composables/useCombatActions.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the Interfaces above. Keep the row's `.meta` order: next-day tag, streak, then diamonds where the pips were.

- [ ] **Step 4: Run the suite and build,** then check both themes at 375px wide with `npm run dev`: a rank-VIII row still fits beside a 3-digit streak and the damage number, and the flare plays once.

- [ ] **Step 5: Commit.** `git commit -m "Show skill ranks on the row and flare the row on a rank-up"`

---

### Task 9: Skill modal: rank block, Rank and Streak lines, crowded Base

**Files:**
- Modify: `src/components/habits/HabitStatsModal.vue`
- Modify: `src/assets/scss/themes/ashen.scss` (rank block per `skill-ranks-2.html` `.rank-block`, `.rank-top`, `.bar`, `.bar-cap`; crowded per `skill-ranks-3.html` `.row.base.c-ash` and `small.cr`; remove the `.skill-meta .pips` rule)
- Test: `src/components/habits/HabitStatsModal.spec.ts`

**Interfaces:**
- Consumes: `breakdown.rankBonus`, `streakBonus`, `rankMultiplier`, `crowded` (Tasks 2–3); `nextRankMilestone` (Task 1); `RankDiamonds`, `rankNumeral` (Task 8); the lock (Task 7).
- Layout (round 2 layout A, top to bottom):
  - **Type line:** icon, then `Physical`, `· Weekly` for a weekly, `· Hard`. Difficulty is the word, and the pips are gone.
  - **Rank block** (new, under the type line, above Days): `.rank-label` reads `Rank V` or `Unranked`, next to `<RankDiamonds>`. A `.rank-bar` fills `min(100, streak / next × 100)%`. Its caption reads `112` on the left and `<b>VI</b> at 200` on the right; weeklies add ` wk` to both numbers. At rank VIII the bar is full and the right caption is empty.
  - **Sum:** Base (when `crowded`: the value in ash, with `<small class="crowded">crowded</small>`), Rank `<small>V</small>` `+500%` (`—` at rank 0), Streak `<small>112</small>` `+112%`, then Gear, Effects, Weekly, Special/Ult and the total as today. Percents are `+${Math.round(bonus × 100)}%`.
  - The Overdrive preview multiplies by `rankMultiplier`.

- [ ] **Step 1: Write the failing tests** in `HabitStatsModal.spec.ts`:
- a hard physical daily's `.skill-meta` reads "Physical · Hard" and has no `.pip`; a medium magic weekly reads "Magic · Weekly · Medium";
- rank 5, streak 112: `.rank-label` "Rank V", 5 diamonds, caption contains "VI at 200", bar width `56%`; Rank row "+500%", Streak row "+112%";
- weekly rank 2, streak 9: caption contains "9 wk" and "III at 10 wk";
- rank 0, streak 4: "Unranked", "I at 10", Rank row "—";
- rank 8, streak 520: bar `100%`, no " at " in the caption;
- a rank 2 healing skill's Rank row reads "+50%";
- the 16th skill's Base shows "crowded", the first skill's doesn't.

- [ ] **Step 2: Run them to verify they fail.** Run: `npx vitest run src/components/habits/HabitStatsModal.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the layout above.

- [ ] **Step 4: Run the suite and build,** then open a ranked, a weekly, a crowded and an added-today skill in both themes at 375px with `npm run dev`, against `docs/mockups/skill-ranks-2.html` layout A.

- [ ] **Step 5: Commit.** `git commit -m "Show rank, streak and crowding in the skill modal"`
