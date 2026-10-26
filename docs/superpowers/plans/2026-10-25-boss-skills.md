# Boss Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From boss #15, bosses can carry hidden skills that fire when a hit knocks their HP past 75/50/25%, shown as generic diamond markers on the boss bar; Wounds stops being a random boss trait.

**Architecture:** All skill logic lives in a new pure engine module, `src/game-engine/bossSkills.ts` (rolling, firing, the lasting-effect lookups, Doom). `generateBoss` rolls a boss's skills and stores them on the `Boss`. `completeHabit` runs a breakpoint check after every hit and returns any fired skill in its result; `useCombatActions` turns that into a log entry and a hit beat. Doom lands from the daily rollover, after the missed-skills popup resolves. The UI only ever sees breakpoint positions and states, never skill ids, until a skill fires.

**Tech Stack:** Vue 3 + TypeScript + Pinia + SCSS, Vitest (`npm run test:unit`), lucide-vue-next icons.

**Spec:** `docs/superpowers/specs/2026-10-25-boss-skills-design.md`. Mockup: `docs/mockups/boss-skill-markers.html`, option **B (Diamond)**.

## Global Constraints

- Build directly on `main`. Commit after each task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pure engine logic in `src/game-engine/`. Components and composables never call `localStorage` directly. New `Boss`/`Character` fields are optional, so old saves load unchanged.
- Day durations use the Wounds semantics: active while `daysBetweenDayKeys(appliedDayKey, currentDayKey) < durationDays`. "2 days" = the day it fired plus the next day. Undying lasts only the day it fired.
- Player-facing copy stays short and terse. Item effect text states plainly what the item does.
- Mobile first: markers are status only, never tap targets, and stay cheap to render (no per-frame animation; one transition when a marker is spent).
- Every HP hit (Rend, Ravage, Doom) leaves the hero at ≥ 1 HP and never raises HP. They ignore armor/MR, and Dawnguard doesn't apply to them.
- Match the surrounding code: comment density, naming, the existing `activeXxx(character, dayKey)` lookup pattern.

## Review Focus

1. **A save from before the update, mid-fight:** the boss has no `skills` and may still carry a stale `woundsAbility`. It shows no markers, and a miss never applies Wounds. → Task 1 (miss test) and Task 7 (no-marks test).
2. **A hero at very low HP hit by Rend, Ravage or Doom** (1.4 HP, 0.6 HP, 0 HP) never drops below 1 HP from it, never gains HP, and the death check (rounded HP) never trips. → Task 3, `hpHitDamage` tests.
3. **The app closed for a week while Doom was pending** lands Doom exactly once, at the next rollover, and never again. → Task 5.
4. **An avoided bad habit kills the boss in the same rollover that Doom is due:** Doom doesn't land, because the new boss has no countdown. → Task 5.
5. **A boss healed back above a spent breakpoint** (Mend, lifesteal, Bloodlust) and then hit back below it fires nothing. → Task 4.

---

### Task 1: Retire the Wounds boss trait

**Files:**
- Modify: `src/game-engine/types.ts` (drop `WoundsAbility` and `Boss.woundsAbility`; update the `WoundsStatusEffect` comments: durationDays/effectRate now come from the boss skill, and 0.25 can only appear on old saves)
- Modify: `src/game-engine/boss.ts:305-328` (stop rolling the ability; the lean becomes the last roll)
- Modify: `src/game-engine/constants/tuning.ts:256-260` (delete `WOUNDS_ABILITY_CHANCE`, `WOUNDS_HIT_CHANCE_MIN/MAX`, `WOUNDS_DURATION_DAYS_OPTIONS`, `WOUNDS_EFFECT_RATE_OPTIONS`)
- Modify: `src/game-engine/combat.ts` `missHabit` (no Wounds roll and no `woundsApplied` in the result; trim its doc comment)
- Modify: `src/composables/useCombatActions.ts` `applyPenalty` (drop the `wounds-applied` log write)
- Modify: `src/game-engine/index.ts` (drop the `WoundsAbility` export)
- Modify: `src/components/boss/BossPanel.vue` (drop the Wounds chance tile and the Wounds chip)
- Test: `src/game-engine/boss.spec.ts`, `src/game-engine/combat.spec.ts`, `src/components/boss/BossPanel.spec.ts`

**Interfaces:**
- Produces: `missHabit(...)` returns `{ character, boss, updatedHabit, wasCrit, attackType, bossLifestealHealed? }`, with no `woundsApplied`.

- [ ] **Step 1: Replace the Wounds-ability tests.** Delete `describe('generateBoss — Wounds ability')` in `boss.spec.ts` and `describe('missHabit — Wounds ability')` in `combat.spec.ts`. Add to `combat.spec.ts`:

```ts
it('never applies Wounds on a miss, even for a boss saved with the old Wounds ability', () => {
  const boss = { ...makeBoss({ physicalAttack: 20, magicAttack: 20 }), woundsAbility: { hitChance: 1, durationDays: 2, effectRate: 0.5 } } as Boss;
  const result = missHabit(makeCharacter(), makeHabit(), boss, DAY_KEY, () => 0);
  expect(result.character.statusEffects ?? []).toEqual([]);
  expect('woundsApplied' in result).toBe(false);
});
```

Keep the `activeWoundsEffect / healingMultiplier` and `completeHabit — healing reduced by an active Wounds effect` tests: Wounds-as-status is unchanged.

- [ ] **Step 2: Run it.** `npx vitest run src/game-engine/combat.spec.ts`. Expected: FAIL (Wounds still applies).
- [ ] **Step 3: Remove the trait** across the files listed above.
- [ ] **Step 4: Fix seeded tests.** Removing the roll shifts the lean's rng draws. Run `npx vitest run src/game-engine src/components/boss`. Update only the expectations that moved because of the shifted rolls (the lean test near `boss.spec.ts:554`, and any seed-pinned personality/lean values). Rewrite the comment there: the lean is now the last roll.
- [ ] **Step 5: Run the full suite and the type check.** `npm run test:unit && npx vue-tsc -b`. Expected: all pass.
- [ ] **Step 6: Commit.** "Stop giving bosses a random Wounds ability"

---

### Task 2: Boss skill data and rolling

**Files:**
- Modify: `src/game-engine/types.ts`
- Modify: `src/game-engine/constants/tuning.ts` (add `BOSS_SKILLS`)
- Create: `src/game-engine/bossSkills.ts`
- Modify: `src/game-engine/boss.ts` `generateBoss` (call `rollBossSkills` last, after the lean)
- Modify: `src/game-engine/index.ts` (export the new types and functions)
- Test: `src/game-engine/bossSkills.spec.ts`

**Interfaces:**
- Produces, in `types.ts`:
  - `export type BossSkillId = 'wounds' | 'bloodlust' | 'blind' | 'mend' | 'rend' | 'doom' | 'sunder' | 'undying' | 'ravage';` (Rend = the 20% hit, Ravage = the 40% hit)
  - `export type Breakpoint = 0.75 | 0.5 | 0.25;`
  - `export interface BossSkillSlot { at: Breakpoint; skill: BossSkillId; spent?: true; fired?: true }`. `spent` is set once a hit crosses it. `fired` is set only on the slot that actually triggered.
  - New optional `Boss` fields, each with a short comment like the neighbouring fields: `skills?: BossSkillSlot[]`, `bloodlustDayKey?: string`, `undyingDayKey?: string`, `doomDueDayKey?: string`.
- Produces, in `tuning.ts`, `TUNING.BOSS_SKILLS` with exactly these values:

```ts
BOSS_SKILLS: {
  UNLOCK_INDEX: { wounds: 15, bloodlust: 15, blind: 15, mend: 15, rend: 20, doom: 20, sunder: 20, undying: 20, ravage: 25 } as Record<BossSkillId, number>,
  // [first boss index of the band, weights for 0/1/2/3 skills]; fixed bands, no blending.
  COUNT_BANDS: [[15, [65, 35, 0, 0]], [20, [45, 35, 20, 0]], [25, [30, 40, 30, 0]], [30, [25, 30, 35, 10]]] as [number, number[]][],
  SLOTS: { 1: [0.5], 2: [0.75, 0.25], 3: [0.75, 0.5, 0.25] } as Record<number, Breakpoint[]>,
  HP_HIT_SKILLS: ['rend', 'ravage', 'doom'] as BossSkillId[],
  DURATION_DAYS: 2, // Wounds, Bloodlust, Blind, Sunder
  WOUNDS_EFFECT_RATE: 0.5,
  BLOODLUST_HEAL_PCT: 3, // of the boss's max HP, per hit it lands
  MEND_HEAL_PCT: 10,
  REND_PCT: 20,
  RAVAGE_PCT: 40,
  DOOM_PCT: 50,
  DOOM_DELAY_DAYS: 3,
  SUNDER_FACTOR: 0.5,
  UNDYING_FLOOR_PCT: 10,
},
```

  Use a type-only import of `BossSkillId`/`Breakpoint` from `../types`.
- Produces, in `bossSkills.ts`: `export function rollBossSkills(index: number, rng: Rng): BossSkillSlot[]`

- [ ] **Step 1: Write the failing tests** in `bossSkills.spec.ts` (sample 2,000 seeds with `createRng(seed)` where noted):
  - `returns no skills and consumes no rng before boss 15`: index 14 → `[]`, and a counting rng was called 0 times.
  - `count odds follow the band`: at index 15, about 35% (±5) of bosses get 1 skill and none get 2. At index 22, about 45/35/20 (±5) for 0/1/2. At index 30, about 25/30/35/10 (±5) for 0/1/2/3.
  - `places slots by count`: every 1-skill boss is `[0.5]`, every 2-skill boss `[0.75, 0.25]`, every 3-skill boss `[0.75, 0.5, 0.25]`, in that order.
  - `only unlocked skills`: no `rend`/`doom`/`sunder`/`undying` below 20, and no `ravage` below 25.
  - `undying only in the 25% slot`, `no repeated skill on a boss`, `at most one of rend/ravage/doom per boss`: checked across all sampled bosses at index 30.
  - `generateBoss stores the rolled skills`: `generateBoss(30, createRng(seed)).skills` deep-equals the matching `rollBossSkills` output, and the boss's other fields match a generation from before skills existed. Assert this by checking `physicalShare` is unchanged for a fixed seed.
- [ ] **Step 2: Run them.** `npx vitest run src/game-engine/bossSkills.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `rollBossSkills`.** Below `UNLOCK_INDEX`'s lowest value, return `[]` before touching rng. Otherwise pick the count with `pickWeighted` from the last band whose start ≤ index. Fill `SLOTS[count]` from the highest breakpoint down: for each slot, choose uniformly (`pickRandom`) among skills that are unlocked, not yet chosen, not an HP hit if one is already chosen, and not `undying` unless the slot is 0.25. Skip the slot if none qualify. In `generateBoss`, attach `skills` only when non-empty, rolled after the lean.
- [ ] **Step 4: Run the tests, then the full suite.** `npx vitest run src/game-engine/bossSkills.spec.ts && npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit.** "Roll hidden skills for bosses from boss 15"

---

### Task 3: Lasting skill effects

**Files:**
- Modify: `src/game-engine/types.ts` (add `BlindStatusEffect` and `SunderStatusEffect`, `{ type: 'blind' | 'sunder'; appliedDayKey: string; durationDays: number }`, to the `StatusEffect` union)
- Modify: `src/game-engine/time.ts` (add `addDaysToDayKey`)
- Modify: `src/game-engine/bossSkills.ts`
- Modify: `src/game-engine/leveling.ts` `effectiveCritChance` (0 while Blind, only when a day key is passed)
- Modify: `src/game-engine/combat.ts` `missHabit` (Sunder halves armor/MR; Bloodlust heal)
- Modify: `src/game-engine/index.ts`
- Test: `src/game-engine/bossSkills.spec.ts`, `src/game-engine/combat.spec.ts`, `src/game-engine/time.spec.ts`

**Interfaces:**
- Produces, in `time.ts`: `addDaysToDayKey(dayKey: string, days: number): string`.
- Produces, in `bossSkills.ts`:
  - `activeBlind(character: Character, currentDayKey: string): BlindStatusEffect | undefined`
  - `activeSunder(character: Character, currentDayKey: string): SunderStatusEffect | undefined`
  - `bloodlustActive(boss: Boss, currentDayKey: string): boolean`: active while `daysBetweenDayKeys(boss.bloodlustDayKey, currentDayKey) < DURATION_DAYS`
  - `undyingActive(boss: Boss, currentDayKey: string): boolean`: `boss.undyingDayKey === currentDayKey`
  - `doomDaysLeft(boss: Boss, currentDayKey: string): number | undefined`: undefined without a countdown, otherwise `max(0, daysBetweenDayKeys(currentDayKey, boss.doomDueDayKey))`
  - `hpHitDamage(currentHealth: number, pct: number): number`: `min(currentHealth * pct / 100, max(0, currentHealth - 1))`
  - `bossSkillMarks(boss: Boss): { at: Breakpoint; state: 'armed' | 'fired' | 'spent' }[]`: `[]` without skills. A slot is `fired` if `fired` is set, `spent` if only `spent` is set, otherwise `armed`.
- Consumes: Task 2's types and `TUNING.BOSS_SKILLS`.

- [ ] **Step 1: Write the failing tests.**
  - `time.spec.ts`: `addDaysToDayKey('2026-02-27', 3)` → `'2026-03-02'`, and `addDaysToDayKey('2026-12-31', 1)` → `'2027-01-01'`.
  - `hpHitDamage`: `(1000, 20)` → `200`; `(1.4, 50)` → about `0.4` (leaves exactly 1); `(0.6, 40)` → `0`; `(0, 50)` → `0`.
  - `activeBlind`/`activeSunder`/`bloodlustActive`: applied `'2026-01-01'` is active on `-01` and `-02` and gone on `-03`. `undyingActive`: true only on the same day.
  - `doomDaysLeft`: due `'2026-01-04'` on `'2026-01-01'` → 3, on the due day → 0, with no countdown → undefined.
  - `bossSkillMarks`: maps `[{at:0.75,skill:'mend',spent:true,fired:true},{at:0.25,skill:'blind'}]` to `[{at:0.75,state:'fired'},{at:0.25,state:'armed'}]`, and never includes a `skill` key.
  - `effectiveCritChance` (`leveling.spec.ts` or `combat.spec.ts`): an active Blind gives 0 with a day key, and the normal value without one.
  - `completeHabit` under Blind: `alwaysCritRng` doesn't crit, but a First Blood holder's first hit on a boss (`playerHasHit` unset) still crits. Use the real First Blood item id from the catalog.
  - `missHabit` under Sunder: with 150 item armor, the damage equals the same miss against 75 armor without Sunder (compare two `missHabit` calls).
  - `missHabit` under Bloodlust: the boss gains `0.03 * maxHealth` on top of its normal lifesteal (capped at max), reported in `bossLifestealHealed`. With Bloodbound Carapace equipped it gains nothing.
- [ ] **Step 2: Run them.** `npx vitest run src/game-engine`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the lookups (same lazy "compare the stored key" pattern as `activeWoundsEffect`), `addDaysToDayKey` (UTC parse, the same approach as `daysBetweenDayKeys`), the Blind check in `effectiveCritChance` (`isForcedCrit` is untouched, so forced crits still land), Sunder in `missHabit`'s `playerResistStat`, and Bloodlust in `missHabit`: add `maxHealth * BLOODLUST_HEAL_PCT / 100` to the boss heal unless `bloodbound`, and fold it into `bossLifestealHealed`.
- [ ] **Step 4: Run the tests.** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit.** "Add Blind, Sunder, Bloodlust and the boss-skill lookups"

---

### Task 4: Firing skills at breakpoints

**Files:**
- Modify: `src/game-engine/bossSkills.ts` (`resolveBreakpoints`, `spendPassedBreakpoints`)
- Modify: `src/game-engine/combat.ts` (`completeHabit` wraps its current body; `resolveBossDefeatIfDead` spends breakpoints passed by Echoing Blade's carry)
- Modify: `src/game-engine/items.ts` (`ItemEffectId` gains `'hushing-bell' | 'omen-hourglass'`)
- Modify: `src/game-engine/constants/tuning.ts` (`ITEM_EFFECTS.HUSHING_BELL_FAIL_CHANCE: 0.5`, `ITEM_EFFECTS.OMEN_HOURGLASS_FACTOR: 0.5`)
- Test: `src/game-engine/bossSkills.spec.ts`, `src/game-engine/bossSkills.relics.spec.ts` (new)

**Interfaces:**
- Produces, in `bossSkills.ts`:
  - `export interface FiredBossSkill { skill: BossSkillId; outcome: 'landed' | 'failed' | 'resisted'; amount?: number }`. `amount` is HP taken (Rend/Ravage) or HP healed (Mend).
  - `resolveBreakpoints(healthBefore: number, boss: Boss, character: Character, currentDayKey: string, rng: Rng): { boss: Boss; character: Character; fired?: FiredBossSkill }`. `boss` is the boss after the hit.
  - `spendPassedBreakpoints(boss: Boss): Boss`: marks every unspent slot with `at * maxHealth >= health` as spent, without firing.
- Produces, in `combat.ts`: `CombatResult` gains `bossSkill?: FiredBossSkill`. `completeHabit` (and therefore `overdriveHabit`) returns it.
- Consumes: Task 3's lookups and `hpHitDamage`.

`resolveBreakpoints`, in order. This is the one algorithm the tests don't fully pin:
1. If `undyingActive(boss, day)` (fired earlier that day), clamp `health` up to `UNDYING_FLOOR_PCT` of max and drop `overkill`.
2. `crossed` = unspent slots where `healthBefore > at * max && health <= at * max`. If there are none, return.
3. Mark every crossed slot `spent`. If `Math.round(health) <= 0`, return with nothing fired (the kill rule).
4. The highest crossed slot gets `fired`. If `hushing-bell` is equipped and `rng() < HUSHING_BELL_FAIL_CHANCE`, the outcome is `failed`. Only this roll consumes rng.
5. Otherwise apply the skill:
   - **wounds:** `resisted` with `wound-immune`; otherwise replace any `wounds` status with `{ appliedDayKey: day, durationDays: 2, effectRate: 0.5 }`.
   - **blind / sunder:** replace any status of that type with a fresh 2-day one.
   - **bloodlust:** set `bloodlustDayKey = day`.
   - **mend:** heal `min(max - health, MEND_HEAL_PCT% of max)`; `amount` is that heal.
   - **rend / ravage:** `pct = REND_PCT | RAVAGE_PCT`, halved by `omen-hourglass`; take `hpHitDamage(currentHealth, pct)`; `amount` is that damage.
   - **doom:** set `doomDueDayKey = addDaysToDayKey(day, DOOM_DELAY_DAYS)`.
   - **undying:** set `undyingDayKey = day`, clamp `health` up to the floor, and drop `overkill`.

- [ ] **Step 1: Write the failing tests** in `bossSkills.spec.ts`. Build bosses with explicit `skills` and call `completeHabit` with damage you control, as `combat.spec.ts` does:
  - `fires when a hit crosses a breakpoint` (a 0.5 `mend` slot, a hit from 60% to 45%): the boss ends at 55%, the slot is `spent` + `fired`, and `bossSkill` is `{ skill: 'mend', outcome: 'landed', amount: 0.1 * max }`.
  - `one hit crossing two lines fires only the first`: slots 0.75 `blind` and 0.25 `sunder`, a hit from 80% to 20%. Blind lands, both slots are spent, and only 0.75 has `fired`.
  - `nothing fires on a kill`: the same slots and a hit that kills. Both are spent, `bossSkill` is undefined, and the character is unchanged.
  - `a breakpoint fires once`: after Mend fires at 0.5, healing the boss to 70% and hitting it back to 40% fires nothing.
  - `undying clamps the triggering hit and holds the floor all day`: a 0.25 `undying` slot, a hit from 30% to 5% leaves 10% with no overkill. A second hit the same day still leaves 10%. A hit the next day can kill.
  - `rend never leaves the hero below 1 HP`: a hero at 1.4 HP ends at 1. `ravage` takes 40%. Both ignore the hero's armor.
  - `doom sets a countdown 3 days out`: fired on `'2026-01-01'`, `doomDueDayKey` is `'2026-01-04'`.
  - `wounds lands at 50% for 2 days and refreshes an older one`. `Aegis of the Unbroken` makes it `resisted` with no status added.
  - `overdrive and Torch of Wrath hits fire skills too`: one test each through `overdriveHabit`, and through a healing `completeHabit` with Torch of Wrath equipped.
  - `Echoing Blade carry spends passed breakpoints`: `resolveBossDefeatIfDead` with overkill carrying a new boss (with skills) to 60%. Its 0.75 slot is spent, not fired, and the character is unchanged.
- [ ] **Step 2: Write the failing relic tests** in `bossSkills.relics.spec.ts`. The relics have no art yet, so they aren't in the catalog. Mock it for this file only:

```ts
vi.mock('./constants/itemCatalog', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./constants/itemCatalog')>();
  return {
    ITEM_CATALOG: [
      ...mod.ITEM_CATALOG,
      { id: 'hushing-bell', name: 'Hushing Bell', icon: 'items/hushing-bell', type: 'equipment', rarity: 'relic', unlockLevel: 1, bonuses: [], effect: 'hushing-bell', effectText: 'Boss skills have a 50% chance to fail.' },
      { id: 'omen-hourglass', name: 'Omen Hourglass', icon: 'items/omen-hourglass', type: 'equipment', rarity: 'relic', unlockLevel: 1, bonuses: [], effect: 'omen-hourglass', effectText: 'Boss skills deal half damage.' },
    ],
  };
});
```

  Tests:
  - With Hushing Bell, an rng returning 0.3 → `outcome: 'failed'`, the slot is spent + fired, and nothing changes. An rng returning 0.7 → the skill lands.
  - With Omen Hourglass, Rend takes 10% and Ravage 20%.
- [ ] **Step 3: Run them.** `npx vitest run src/game-engine/bossSkills.spec.ts src/game-engine/bossSkills.relics.spec.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.** Rename the current `completeHabit` body to an unexported `resolveCompletion` with the same signature. The exported `completeHabit` calls it, then `resolveBreakpoints(boss.health, result.boss, result.character, currentDayKey, rng)`, and returns the merged result with `bossSkill`. In `resolveBossDefeatIfDead`, run `spendPassedBreakpoints` on `nextBoss` when `carried > 0`. Add the effect ids and tuning values.
- [ ] **Step 5: Run the full suite.** `npm run test:unit`. Expected: PASS, with seeded combat tests unchanged (no new rng draws without Hushing Bell).
- [ ] **Step 6: Commit.** "Fire boss skills when a hit crosses a breakpoint"

---

### Task 5: Doom lands at the rollover

**Files:**
- Modify: `src/game-engine/bossSkills.ts` (`resolveDoom`)
- Modify: `src/composables/useCombatActions.ts` (`landDoom`, returned from the composable)
- Modify: `src/composables/useDailyRollover.ts` (land Doom when nothing is queued)
- Modify: `src/composables/useMissedSkillsGate.ts` (`acknowledge` lands Doom last)
- Modify: `src/store/activityLogStore.ts` (entry `{ kind: 'doom-landed'; amount: number }`)
- Test: `src/game-engine/bossSkills.spec.ts`, `src/game-engine/bossSkills.relics.spec.ts`, `src/composables/useDailyRollover.spec.ts`, `src/composables/useMissedSkillsGate.spec.ts`

**Interfaces:**
- Produces, in `bossSkills.ts`: `resolveDoom(character: Character, boss: Boss, currentDayKey: string): { character: Character; boss: Boss; amount?: number }`. No-op without a countdown, before the due day, or when the hero is dead (`Math.round(currentHealth) <= 0`). Otherwise it takes `hpHitDamage(currentHealth, DOOM_PCT)` (halved by `omen-hourglass`) and clears `doomDueDayKey`.
- Produces, in `useCombatActions`: `landDoom(currentDayKey: string = dailyPeriodKey(debugClockStore.now())): void`. It calls `resolveDoom` with that day key, writes both stores, plays `playHit({ kind: 'hurt', amount, hp: -amount })` and logs `doom-landed`. It's a no-op when nothing lands.

- [ ] **Step 1: Write the failing engine tests.**
  - Due `'2026-01-04'`: no-op on `-03`. On `-04`, a 1000 HP hero ends at 500 and the countdown is cleared. A second call that day is a no-op. On `-10` (app closed for a week) it lands once.
  - A hero at 0 HP: no-op.
  - In the relic spec: Omen Hourglass makes it 25%.
- [ ] **Step 2: Write the failing composable tests.**
  - In `useDailyRollover.spec.ts`: with a due Doom and no misses, the rollover lands it (hero HP halves, a `doom-landed` entry is logged).
  - In `useMissedSkillsGate.spec.ts`: with a due Doom and one queued miss, Doom lands only after `acknowledge()`, after the miss. Hero HP = (HP − miss damage) × 0.5. Compute the miss damage from a parallel `missHabit` call, or assert the order through the log: `doom-landed` is newer than `hit`.
  - In `useMissedSkillsGate.spec.ts`: with a due Doom and a queued avoided bad habit whose reward kills the boss, `acknowledge()` leaves hero HP unchanged by Doom, and the new boss has no `doomDueDayKey`.
- [ ] **Step 3: Run them.** `npx vitest run src/game-engine/bossSkills.spec.ts src/composables/useDailyRollover.spec.ts src/composables/useMissedSkillsGate.spec.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - `resolveDoom` and `landDoom`.
  - At the end of `useDailyRollover(now)`, after the Ember Heart regen: call `landDoom(todayKey)` only when the gate's `hasPending.value` is false.
  - At the end of `acknowledge()`, after clearing the queue: call `landDoom()`.
  - Add the log entry type.
- [ ] **Step 5: Run the full suite.** `npm run test:unit`. Expected: PASS.
- [ ] **Step 6: Commit.** "Land Doom after the day's misses resolve"

---

### Task 6: Show fired skills on the stage and in the log

**Files:**
- Modify: `src/store/activityLogStore.ts` (entry `{ kind: 'boss-skill'; skill: BossSkillId; outcome: 'landed' | 'failed' | 'resisted'; amount?: number }`)
- Modify: `src/composables/useCombatActions.ts` `applyReward`
- Modify: `src/components/ui/ActivityLog.vue`
- Modify: `src/components/ui/statIcons.ts` (new icons)
- Test: `src/composables/useCombatActions.spec.ts`, `src/components/ui/ActivityLog.spec.ts` (create it if missing, following the closest component spec)

**Interfaces:**
- Consumes: `CombatResult.bossSkill` (Task 4).
- Produces: `STAT_ICONS` entries `bloodlust` (Droplets, `var(--dmg-physical)`), `blind` (EyeOff, `var(--icon-crit)`), `sunder` (ShieldX, `var(--icon-steel)`), `mend` (HeartPlus, `var(--dmg-physical)`), `bossHit` (Swords, `var(--dmg-physical)`), `doom` (Hourglass, `var(--icon-violet)`), `undying` (`Infinity as InfinityIcon`, so the global isn't shadowed; `var(--icon-steel)`), `skillFailed` (BellOff, `var(--icon-gold)`). Task 8 uses these names.

In `applyReward`, when `result.bossSkill` is set:
- **The hero's HP for the strike excludes the skill's hit.** Let `skillHit = bossSkill.outcome === 'landed' && (skill === 'rend' || skill === 'ravage') ? bossSkill.amount : 0`. Use `healthAfter = result.character.currentHealth + skillHit` everywhere `applyReward` uses `healthAfter` today, including the heal path's log amount. That way lifesteal and reflect still show correctly.
- After the strike's `playHit`, a landed Rend/Ravage plays `playHit({ kind: 'hurt', amount: skillHit, hp: -skillHit })`.
- Log after the existing sub-effect entries and before the main skill entry, so the headline stays on top. A landed `wounds` logs the existing `wounds-applied` (`durationDays: 2`, `effectRate: 0.5`); everything else logs `boss-skill`.

`ActivityLog.vue` copy (exact):

| Entry | Line |
|---|---|
| bloodlust landed | `Bloodlust · 2 days` |
| blind landed | `Blinded · 2 days` |
| sunder landed | `Sundered · 2 days` |
| mend landed | `The boss mends +{amount}` |
| rend landed | `Rend — took {amount} damage` |
| ravage landed | `Ravage — took {amount} damage` |
| doom landed | `Doom falls in 3 days` |
| undying landed | `Undying until tomorrow` |
| wounds resisted | `Wounds resisted` |
| any failed | `A boss skill fails` |
| doom-landed | `Doom — took {amount} damage` |

Amounts are rounded and styled like the existing damage and heal numbers in the log.

- [ ] **Step 1: Write the failing tests.**
  - `useCombatActions.spec.ts`: checking off a habit whose hit crosses a `rend` slot logs `boss-skill` `{ skill: 'rend', outcome: 'landed' }`, and hero HP drops by its amount.
  - A crossing on a `wounds` slot logs `wounds-applied` with `durationDays: 2, effectRate: 0.5`.
  - `ActivityLog.spec.ts`: renders `Rend — took 200 damage` for that entry, and `A boss skill fails` for a failed one.
- [ ] **Step 2: Run them.** `npx vitest run src/composables/useCombatActions.spec.ts src/components/ui`. Expected: FAIL.
- [ ] **Step 3: Implement** the `applyReward` handling, the log entry type, the log rendering and the icons.
- [ ] **Step 4: Run the full suite.** `npm run test:unit`. Expected: PASS.
- [ ] **Step 5: Commit.** "Report boss skills in the log and on the stage"

---

### Task 7: Breakpoint markers on the boss bars

**Files:**
- Modify: `src/components/ui/HealthBar.vue` (optional `marks` prop; base marker style, which is what Minimalist uses)
- Modify: `src/assets/scss/themes/ashen.scss` (option B diamond under `:root[data-theme='ashen']`)
- Modify: `src/components/boss/BossPanel.vue` (both boss `HealthBar`s: stage block and modal)
- Modify: `src/components/boss/BossBar.vue` (mirrored marks, since this bar drains toward the portrait on the right)
- Modify: `src/components/fight/FightStage.vue` (pass the marks into `BossBar`)
- Test: `src/components/ui/HealthBar.spec.ts` (create if missing), `src/components/boss/BossPanel.spec.ts`, `src/components/boss/BossBar.spec.ts`

**Interfaces:**
- Consumes: `bossSkillMarks(boss)` (Task 3).
- Produces: `HealthBar` prop `marks?: { at: number; state: 'armed' | 'fired' | 'spent' }[]`. `at` is the fraction from the bar's left edge. `BossBar` gets a `marks` prop of the same type and passes `at: 1 - at`.

Marker rules:
- One `<i class="health-bar-mark" :class="state">` per mark, at `left: at * 100%`, `aria-hidden`.
- The label sits above the marks (z-index), as in the mockup.
- `armed` is visible. `spent` fades to opacity 0 and `fired` flares (scales up with a glow while fading), each by CSS **transition**, never a keyframe animation. That way a reloaded page shows spent marks already gone, with no replay.
- The base (Minimalist) style is a small rotated square in `var(--text)` with no glow.
- Ashen copies option B from `docs/mockups/boss-skill-markers.html`: 9px diamond (7px on the drop-down bar), dark core, `--gold-hi` border, `--gold` inset, perched on the bar's top edge. The fired flare is ~0.9s and the spent fade ~0.5s.
- `prefers-reduced-motion`: no scale, just the fade.

- [ ] **Step 1: Write the failing tests.**
  - `HealthBar.spec.ts`: `marks=[{at:0.75,state:'armed'},{at:0.25,state:'spent'}]` renders two `.health-bar-mark` elements, with `left: 75%` and `left: 25%`, and the second has class `spent`.
  - `BossBar.spec.ts`: a mark at 0.75 renders at `left: 25%`.
  - `BossPanel.spec.ts`: a boss with `skills: [{ at: 0.5, skill: 'doom' }]` renders one armed mark on the stage bar, and no element's text or attributes contain `doom`. A boss without `skills` (an old save) renders no marks.
- [ ] **Step 2: Run them.** `npx vitest run src/components`. Expected: FAIL.
- [ ] **Step 3: Implement** the prop, the styles, and the wiring.
- [ ] **Step 4: Run the tests and lint.** `npm run test:unit && npm run lint`. Expected: PASS.
- [ ] **Step 5: Check it by eye.** Run `npm run dev`. With `playwright-cli` at 390px wide:
  - Edit the saved game in localStorage (the key and shape are in `src/store/plugins/localStoragePersistence.ts`) so the boss has `skills: [{ at: 0.75, skill: 'mend' }, { at: 0.5, skill: 'blind' }, { at: 0.25, skill: 'undying' }]` and 80% HP.
  - Reload, then screenshot the stage once, and once scrolled down so the drop-down bar shows, in Ashen.
  - Expected: diamonds on both bars, the HP numbers readable over them, and no layout shift.
- [ ] **Step 6: Commit.** "Mark boss skill breakpoints on the boss bars"

---

### Task 8: Status chips and the boss modal

**Files:**
- Modify: `src/components/character/CharacterPanel.vue` (stage chips and the modal's `activeEffects`)
- Modify: `src/components/boss/BossPanel.vue` (stage chips and modal tiles for active boss-side effects)
- Test: `src/components/character/CharacterPanel.spec.ts`, `src/components/boss/BossPanel.spec.ts`

**Interfaces:**
- Consumes: `activeBlind`, `activeSunder`, `bloodlustActive`, `undyingActive`, `doomDaysLeft` (Task 3) and the icons from Task 6.

Hero, in the `bane` tone with days left, in both the stage chip line and the modal effects list:
- Wounds: the text becomes `Wounded · 50% heal`, unchanged otherwise.
- `Blinded`.
- `Sundered`.
- `Doom`, with days from `doomDaysLeft(bossStore.boss, day)`.

The crit chip already passes the day key, so it shows 0% while Blind.

Boss:
- Stage chips: Bloodlust (`bloodlust` icon, days left), Undying (`undying` icon, no days), Doom (`doom` icon, days left).
- Modal tiles: `Bloodlust` with note `3% max HP per hit · {n}d`, `Undying` with note `Can't fall below 10% today`, `Doom` with note `{n}d`.
- Nothing about unfired skills appears anywhere.

- [ ] **Step 1: Write the failing tests.**
  - CharacterPanel: an active Blind shows a `Blinded` effect with `2d` on its first day. A boss with `doomDueDayKey` 3 days out shows `Doom · 3d`.
  - BossPanel: `bloodlustDayKey` set today shows the Bloodlust chip and tile. `undyingDayKey` set today shows Undying, and yesterday's doesn't.
- [ ] **Step 2: Run them.** `npx vitest run src/components/character src/components/boss`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 5: Commit.** "Show active boss-skill effects on the hero and boss"

---

## Not in this plan

- **The Hushing Bell and Omen Hourglass catalog entries.** They wait on art (`npm run item-icon`, a CREDITS.md row, then `npm run item-catalog-page`). The engine supports both effects from Task 4. Adding them is two catalog lines using the stats in the spec: Hushing Bell +10% health, +5% EXP; Omen Hourglass +20% health, +100 armor.
- **Shields, new stage effects for skills, and a debug control to spawn chosen skills.**
