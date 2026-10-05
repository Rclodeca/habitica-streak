# Quests — Design Spec

Status as of 2026-10-04. Adds a new, entirely new mechanic: one-time, player-authored "quests" that a boss kill has a chance to offer. Unlike habits (recurring, system-generated damage/healing), a quest is a single freeform task the player defines themselves (description, difficulty, due date), resolved exactly once — on-time completion grants a chunk of bonus EXP, a missed due date deals damage.

## Context

This is a net-new EXP income source layered on top of the existing boss-kill/milestone/expGain-habit economy. The existing economy has one hard invariant worth re-stating since this spec leans on it: `BOSS_EXP_GROWTH_RATE` (1.12) must stay strictly below `BOSS_GROWTH_RATE` (1.205), or a sufficiently consistent player could drive boss index — and therefore EXP income — into an unbounded runaway. Quest EXP is designed to inherit the existing boss-kill curve rather than introduce a second independent growth rate, specifically to avoid re-litigating that invariant.

## Confirmed product decisions

- **Multiple quests can be active at once.** A boss kill's quest-offer roll is independent of how many quests the player already has pending — no cap, no queue-blocking.
- **Flat 40% chance per boss kill** to offer a quest, independent of boss index. Quests are a pacing/flavor mechanic, not a progression-scaling reward like items — no growth curve to tune.
- **Due date is a calendar date** (native date picker, `min` = today), not a relative day-count.
- **A missed due date is gated through a confirmation popup** (mirrors the existing missed-habit flow), including an "I actually did this" override — consistent with how habit-miss detection can also be wrong (player forgot to check a box).
- **Quest difficulty (easy/medium/hard) scales both the success reward and the failure penalty**, using the existing `DIFFICULTY_WEIGHT` (1/1.5/2, medium-centered at 1.5) — risk stays proportional to reward.
- **Reject** just closes the offer — no record, no cooldown, no effect on the next roll.

## Data model

`src/game-engine/types.ts` — new type, no changes to existing types:

```ts
export interface Quest {
  id: string;
  description: string;       // free-text one-time task, player-authored
  difficulty: Difficulty;    // reuses the existing Difficulty type
  dueDateKey: string;        // YYYY-MM-DD — same format as dailyPeriodKey
  // The boss whose kill offered this quest. Locks in the EXP reward base (see
  // "EXP reward" below) so procrastinating past later boss kills can't
  // inflate the payout — the reward is always "a slice of the boss that
  // dropped it," not of whatever boss is current when it's resolved.
  bossIndexAtOffer: number;
}
```

No `status` field: a quest only exists in the store while pending. Completing or missing one removes it and writes an activity-log entry instead — mirrors how habit misses/rewards only log on resolution, never on detection.

## `src/game-engine/quests.ts` (new module)

Pure functions only, no store/UI concerns — same layering as `boss.ts`/`items.ts`.

```ts
/** Flat per-boss-kill chance (TUNING.QUEST_DROP_CHANCE) that a kill offers a quest. */
export function rollQuestOffer(rng: Rng): boolean;

/**
 * Bonus EXP for completing `quest` on time: a difficulty-scaled slice of the
 * boss-kill EXP reward for the boss that offered it (TUNING.QUEST_EXP_DIFFICULTY_PCT),
 * NOT the current boss — see Quest.bossIndexAtOffer.
 */
export function questExpReward(quest: Quest): number; // bossExpReward(quest.bossIndexAtOffer) * QUEST_EXP_DIFFICULTY_PCT[quest.difficulty]

/**
 * Damage dealt for missing `quest`'s due date, using the CURRENT boss's
 * attack stats (consistent with missHabit, which always uses live boss
 * state) and a difficulty-scaled multiple of the existing medium-weekly-miss
 * formula.
 */
export function questMissDamage(quest: Quest, boss: Boss, rng: Rng): number;
```

`questMissDamage` reuses the existing miss-damage shape (coin-flip physical/magic attack, `bossMissDamage`, crit roll, resist mitigation) scaled by `DIFFICULTY_WEIGHT[quest.difficulty] / 1.5` and `TUNING.WEEKLY_MISS_MULTIPLIER` — i.e. a medium quest's miss is defined to equal a missed medium weekly habit, with easy/hard scaled proportionally (0.67x / 1.33x). Exact composition (how much logic lives in `quests.ts` vs. reusing `missHabit`'s internals directly) is implementer's discretion — the formula result is the contract, not the code shape.

New tuning constants (`constants/tuning.ts`):

```ts
QUEST_DROP_CHANCE: 0.4,
QUEST_EXP_DIFFICULTY_PCT: { easy: 0.25, medium: 0.5, hard: 0.75 },
```

## Boss-kill integration

`resolveBossDefeatIfDead` (`combat.ts`) gains `questOffered: boolean` on its return. The `rollQuestOffer` roll happens **last** — strictly after the next boss's `generateBoss` call — so it never perturbs the rng() sequence any existing seeded test depends on (same "rolled last" precedent `woundsAbility` already established in `boss.ts`).

In `useCombatActions.applyReward`, the defeated boss's index must be captured *before* `bossStore.setBoss()` overwrites it — the same pattern already used for the `boss-defeated` log entry (`bossStore.boss.index` read before the overwrite). If `questOffered`, that captured index is pushed into a new `useQuestOfferQueue` composable (mirrors `useItemDropQueue`'s module-scoped-queue pattern, since a multi-kill action could in principle queue more than one offer before the player responds to either).

`applyReward`'s return type changes from `ItemDef[]` to `{ itemsDropped: ItemDef[]; questOffered: boolean }` (or equivalent) — every call site (`HabitListItem.vue`, `HabitStatsModal.vue`, `useMissedSkillsGate.acknowledge`) updates accordingly to also enqueue a quest offer when present.

## Accept/create flow

One new `QuestOfferModal.vue`, mounted once in `AppShell.vue` alongside the other popups. Two steps in one modal:

1. "A quest has appeared — accept it?" with Accept/Reject buttons. Reject dismisses immediately and advances `useQuestOfferQueue`'s queue — no record of the rejected offer.
2. On accept: a form (mirrors `AddHabitModal.vue`'s structure) with a description text input, a difficulty `<select>` (easy/medium/hard), and a due-date `<input type="date">` (`min` = today's `dailyPeriodKey`). Submitting creates the `Quest` in a new `questStore`, with `bossIndexAtOffer` set from the offer captured in step 1.

## Quest section (new UI, placed between HabitList and ActivityLog)

New `QuestSection.vue` in `src/components/quests/`, wired into `AppShell.vue` directly below `<HabitList />` and above `<ActivityLog />`. Shows every pending quest: description, due date, a difficulty badge, and a checkbox to mark it complete now.

Checking a quest off (only reachable while it's still pending, i.e. not yet past due — mirrors `checkOffHabit`'s period-key guard as the authoritative "can't resolve twice" check): grants `questExpReward(quest)` via `addExpAndResolveLevelUps`, writes a `quest-completed` activity-log entry, removes the quest from the store.

## Missed-deadline flow

`useDailyRollover.ts` gains a second loop, over `questStore.quests`, alongside its existing habit loop: any quest whose `dueDateKey` is strictly before today (`daysBetweenDayKeys(quest.dueDateKey, dailyPeriodKey(now)) > 0`) queues into a new `useQuestMissGate` composable + `QuestMissPopup.vue` — a structural mirror of `useMissedSkillsGate`/`MissedSkillsPopup`, including the override checkbox.

On acknowledge:
- **Overridden** ("I actually did this"): resolves as a completion — same `questExpReward` grant and `quest-completed` log entry as checking it off on time.
- **Not overridden**: applies `questMissDamage` to the character (using the live `bossStore.boss`), checks for death exactly like `applyPenalty` does today (Phoenix Feather revive check, then `triggerDeath()` if still dead), and writes a `quest-failed` activity-log entry.

Either outcome removes the quest from `questStore`.

## Activity log

`src/store/activityLogStore.ts` — `ActivityLogEntry` union gains two variants:

```ts
| { id: string; kind: 'quest-completed'; description: string; amount: number }
| { id: string; kind: 'quest-failed'; description: string; amount: number }
```

## Persistence

`src/store/plugins/saveState.ts` — `SaveStateV5` gains `quests?: Quest[]` as an **optional** field, no schema-version bump (same precedent as `activityLog` when it was added: nothing existing depends on it, so an old save without it just starts with zero pending quests instead of forcing a fresh start).

`src/store/index.ts` — new `questStore` (`defineStore('quests', ...)`, same `initFromSave`/plain-setter shape as the other four stores) wired into `initializeStores()` alongside the existing four; `setupPersistence` picks it up automatically since it iterates all active stores.

## EXP economy rebalance

Assuming every offered quest is accepted and completed on time (the generous upper bound) and an average difficulty pick of "medium" (`QUEST_EXP_DIFFICULTY_PCT.medium` = 0.5), expected extra EXP per boss kill ≈ `QUEST_DROP_CHANCE * 0.5` = 20% on top of today's `bossExpReward`. To hold overall leveling pace roughly where it is today:

```
BASE_BOSS_EXP: 40 -> 33   // 40 / 1.2 ≈ 33.3, rounded down
```

`BOSS_EXP_GROWTH_RATE`, `MILESTONE_EXP`, and `expGain`-habit stats are untouched — real-world accept/completion rates will be below 100%, so this cut is deliberately conservative (a slight net buff once quests ship), not an exact wash. Same "approximate by design" philosophy as every other pass in `tuning.ts`.

## Testing

- `game-engine/quests.spec.ts` (new): `rollQuestOffer` respects `QUEST_DROP_CHANCE` across seeds; `questExpReward` scales by `QUEST_EXP_DIFFICULTY_PCT` and uses `bossIndexAtOffer`, not a different boss index passed separately; `questMissDamage` matches a missed medium weekly habit's damage at medium difficulty, and scales proportionally at easy/hard.
- `game-engine/combat.spec.ts`: `resolveBossDefeatIfDead` surfaces `questOffered` without disturbing existing seeded item-drop/next-boss assertions (rolled last).
- `composables/useDailyRollover.spec.ts`: an overdue quest queues into the miss gate; a not-yet-due quest doesn't.
- New `composables/useQuestOfferQueue.spec.ts` / `useQuestMissGate.spec.ts`, mirroring the existing `useItemDropQueue.spec.ts` / miss-gate test shape.
- `store/characterStore.spec.ts` or a new `store/questStore.spec.ts`: quest creation, completion, and miss-resolution each leave exactly one quest removed and one activity-log entry written.

## Deliberately out of scope (this pass)

- No quest editing once accepted (description/difficulty/due-date are fixed at creation) — rejecting and waiting for a new offer is the only "redo."
- No limit on simultaneously active quests, and no pity/anti-stacking mechanic if a player lets many pile up.
- No quest-specific items, rarity, or boss-personality interaction — quests are a flat mechanic layered on the existing economy, not a new progression axis.
- No UI mockups — exact modal/list styling is implementer's discretion within this project's existing placeholder-art, utilitarian UI conventions.
