# Progress

Status as of 2026-09-17. Full spec/formulas: `docs/plan.md`. Original idea: `Seed task.txt`.

## Status: MVP core loop complete and playable

Built from an empty repo across 9 planned tasks + a final whole-branch review + fix wave, all directly on `main` (no feature branch/PR — none was set up for this repo, no remote configured). 97 unit tests passing, type-check clean.

**What works end to end:** create a character with randomized stats → add daily/weekly habits (difficulty chosen, damage type auto-assigned) → check habits off to damage the current boss, proportionally split by difficulty so adding habits never inflates total damage → miss a habit and take boss damage instead → streaks build a per-habit damage multiplier and grant milestone EXP → kill a boss to level up and advance to a scaled-up, randomly-"personality"'d next boss → die and reset (fresh character, boss back to index 1, habits kept but damage type re-rolled) → everything persists to `localStorage` across reloads.

**Run it:** `npm run dev` (Vite dev server), `npm run test:unit` (Vitest), `npx vue-tsc --noEmit` (type-check), `npm run lint` (ESLint — currently reports ~99 pre-existing style findings, all cosmetic, intentionally left unfixed).

## Deviations from the plan worth knowing about

The plan (`docs/plan.md`) had a few gaps/bugs surfaced during implementation, resolved as follows — see git history for full detail (`git log --oneline`, each commit maps to one plan task or fix round):

1. **Damage-type ↔ stat-field naming bridge**: the plan's own pseudocode assumed `character.starterStats[habit.damageType]` worked directly, but `starterStats` fields are `physicalDamage`/`magicDamage`/`healing` while `damageType` values are `physical`/`magic`/`healing`. Fixed via an exported `DAMAGE_TYPE_STARTER_STAT` map in `src/game-engine/combat.ts` (re-exported from `game-engine/index.ts`), reused everywhere this mapping is needed (don't re-declare it — e.g. `HabitStatsModal.vue` imports it rather than having its own copy).
2. **Milestone EXP was computed but never applied**: `completeHabit` always returned a `milestoneExp` number, but no task in the original plan ever added it to the character's actual EXP. Fixed in `useCombatActions.ts`'s `checkOffHabit` — applies it via `addExpAndResolveLevelUps` before checking for boss defeat, so a simultaneous milestone-cross + boss-kill stacks both EXP grants correctly.
3. **Double-completion had no engine-level guard**: originally the only thing stopping a habit from being completed twice in one period was a UI checkbox `:disabled` binding. `checkOffHabit` now has an authoritative early-return guard comparing `lastCompletedPeriodKey` against the current period key, so any future caller (not just the current UI) is protected.
4. **ESLint was installed (Task 1) but never configured** until the final review — `eslint.config.js` now exists with a `lint` script; ~99 pre-existing style findings surfaced and were deliberately left unfixed (cosmetic).

## Deferred / not yet built

- **The ~99 ESLint findings** — all cosmetic `.vue` style warnings plus 2 `multi-word-component-names` errors on `Modal.vue`/`Sprite.vue`.
- `meta.lastRolloverCheckedAt` in the save-state schema is written but nothing reads it (rollover actually keys off each habit's own `lastCheckedPeriodKey`) — harmless, just vestigial.

## Testing/debug tooling added post-MVP

`src/store/debugClockStore.ts` + `src/components/debug/SkipDayButton.vue` — a session-only (not persisted) clock offset with a "Skip to next day (testing)" button in the UI, so the daily/weekly miss-rollover path can be exercised without waiting on the real clock. `checkOffHabit` and the habit-row completion check both read from this clock instead of `new Date()` directly, so skipping stays consistent with completions. Safe to remove later if no longer needed — it's fully isolated (one store, one component, three call-site swaps).

## Items/equipment (added post-MVP)

A curated 15-item catalog (3 tiers × 5 stat categories: physical/magic/healing/health/exp-gain) drops off boss kills via a step curve (`TUNING.ITEM_DROP_EVERY_N_BOSSES`/`ITEM_DROP_MAX_COUNT`) and is unique per character — once owned, an item leaves that character's drop pool until the next death/reset. 4 interchangeable equip slots (no slot-type restrictions). `effectiveStat()` in `game-engine/leveling.ts` layers the equipped-item bonus on top of the existing level-scaled stat everywhere `statAtLevel` used to be read directly (`combat.ts`, `CharacterPanel.vue`, `CharacterStatsModal.vue`, `HabitStatsModal.vue`); `addExpAndResolveLevelUps` applies the `expGain` bonus internally so no caller can forget it. New `InventoryModal.vue` (equip/unequip UI) and a loot toast (`useLootToast.ts`/`LootToast.vue`) surface drops. See `docs/superpowers/specs/2026-09-16-items-equipment-design.md` for the full design.

## Where to resume

Read `docs/plan.md` for the full formula/architecture spec before making changes — it's the binding design doc this MVP was built against. Git history is otherwise the source of truth for what changed and why (commit messages map 1:1 to plan tasks).
