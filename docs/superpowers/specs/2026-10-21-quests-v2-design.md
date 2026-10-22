# Quests v2 — Design Spec

Status as of 2026-10-21. Supersedes the reward, offer, and drop-chance parts of `2026-10-04-quests-design.md`. Quests become player-added at any time with a weekly diminishing EXP curve scaled to player level, and a second kind, "side quests", is introduced as event-only quests that pay a rare item instead of EXP.

## Goals

- Quests are a natural habit-tracker feature: players add one-off tasks whenever they want, with no cap on how many.
- Quest EXP is always a **fraction of the current level**: under one level at level 1, and growing as levels get more expensive, so it keeps feeling rewarding.
- One quest per week is the expected baseline. Beyond that is a small, bounded bonus. A week with no quests leaves the player slightly behind.
- Quest EXP is a **small, tunable slice** of income. It must not be a way to outscale the boss by spamming.
- Quests are one of several **small, hard-to-stack** ways to keep up with or outscale the boss. The others (EXP-skill streaks, EXP items) stay as they are, with the `expGain` rebalance below.
- Every quest carries risk: a due date, and damage if it is missed.
- Side quests stay rare and special: event-only, item-only reward, no effect on the EXP economy.

## Confirmed product decisions

- **Two quest kinds, one list.** Regular quests and side quests share the same Quest section in the UI. Side quests have a distinct visual treatment.
- **Regular quests** can be added at any time, in any number. Completing one on time pays EXP from the weekly curve below.
- **Side quests** are offered only by the existing `quest` event (renamed, see below). They pay a rare item and **no EXP**, and they never touch the weekly counter or the curve.
- **Every quest has a required due date and takes a hit if it is missed.** This applies to regular and side quests alike, using the existing miss flow (confirmation popup with the "I actually did this" override). There must always be risk.
- **Difficulty** is player-chosen: easy 0.7x, medium 1.0x, hard 1.3x, applied to the slot reward and, as today, to the miss damage. All numbers below are for medium.
- **Quest EXP is a percentage of `expToNextLevel`** at the player's level when the quest is completed. Default 25% for a medium quest in slot 1.
- **Weekly counter** resets on the calendar week (the existing `weeklyPeriodKey`).
- **The on-curve quest count is tunable**, including decimals. Default **1**: one medium quest per week is the baseline, anything beyond is extra, and a week with none puts you slightly behind.
- **Hard ceiling on quest EXP per week.** Slots past the last weight pay nothing.
- **Tap a quest to see its reward.** Regular quests show a vague tier from difficulty only ("Small / Medium / Large EXP"); the exact EXP is never shown because it depends on how many quests were already completed that week. Side quests show the actual item.
- **Run-exclusive side-quest items.** At the start of each run a few rare items are randomly flagged as obtainable only through side quests.

## The reward curve

### Weekly target

```
weeklyTargetExp(level) = expToNextLevel(level) * TUNING.QUEST_TARGET_LEVEL_FRACTION   // default 0.25
```

Level is read at the moment of completion. This is the slot-1 payout for a medium quest at the default `N = 1`. Examples at 0.25:

| Level | `expToNextLevel` | Slot-1 medium quest |
| --- | --- | --- |
| 1 | 25 | 6 |
| 5 | 150 | 38 |
| 10 | 260 | 65 |
| 20 | 440 | 110 |
| 25 | 550 | 138 |

### Slot shape

Each on-time completion in a calendar week takes the next slot. The slot's base value is a percentage of the weekly target (medium difficulty):

```
slot:   1    2   3   4   5   6   7   8+
base: 100   60  35  20  10   5   2   0
```

With the default on-curve count of 1, slot 1 pays exactly the weekly target. Everything after is a bonus with a fatter tail than the first draft: the second quest is worth 60%, the third 35%. Total from all 7 slots is 232% of target, so spamming cannot push a player past +132% of target per week, however many quests they add. Slot 8+ pays 0, but the quest still completes, logs, and clears. Slot values live in `TUNING.QUEST_SLOT_WEIGHTS`.

### Normalizing to a tunable on-curve count

`TUNING.QUESTS_PER_WEEK_ON_CURVE` (call it `N`, default 1, any positive number) is how many quests per week count as the baseline.

Let `C(n)` be the cumulative sum of the first `n` slot weights, linearly interpolated for fractional `n` (with the default weights `C(1) = 100`, `C(1.5) = 130`, `C(2) = 160`, `C(3) = 195`). The scale factor is:

```
k = 100 / C(N)
slotReward(i) = weeklyTargetExp(level) * (w_i / 100) * k * difficultyMult
```

At `N = 1`, `k = 1` and slot rewards equal the weights directly. Examples (target = 100 EXP, medium):

| N   | k     | slot 1 | slot 2 | slot 3 | all 7 slots |
| --- | ----- | ------ | ------ | ------ | ----------- |
| 1   | 1.00  | 100    | 60     | 35     | 232         |
| 1.5 | 0.77  | 77     | 46     | 27     | 178         |
| 2   | 0.63  | 63     | 38     | 22     | 145         |
| 3   | 0.51  | 51     | 31     | 18     | 119         |

Raising `N` makes each quest worth less and needs more of them to hit the baseline. It also lowers the ceiling as a multiple of target, because the same tail is scaled down.

The slot is decided **at completion time** by the number of regular quests already completed on time in the current calendar week, not by the order quests were added. Difficulty scales the slot's payout but does not change which slot it occupies. A missed quest does not consume a slot.

## Economy

Boss-kill EXP alone leaves a player slightly short of the pace the quest slice completes. A week with no quests is slightly behind; one quest is on pace; extra quests overlevel by a bounded amount.

**Simulation findings** (real engine, 40-60 seeds, 52 weeks, a 4 daily + 2 weekly habit player at 85% completion):

- Weekly EXP income is roughly **flat across levels** (about 300-400/week), because boss EXP per kill grows 12% per boss while kills per week fall as bosses outgrow the player.
- Because `expToNextLevel` grows with level while income does not, a percentage-of-level quest is **small relative to income early and larger late**. At 25%, one quest is about 2% of weekly income at level 1, about 20% at level 10, and 40% at level 25. A skipped week therefore costs little early and more late. This is accepted by design (the early game is a sprint; the cost of skipping grows when it matters).
- With a flat 85 EXP target the simulation held within about ±12% of a 25% skip cost at every level. Choosing level-scaling trades that for the feel described in Goals.
- Source impact versus a reference player at week 52: 1 quest/week about 1.06x, 3 quests/week about 1.14x, 7 quests about 1.27x (with the old thinner tail); realistic EXP items +16% about 1.11x, best case +42% about 1.36x; an `expGain` streak of 30 days about 3.4x and 60 days about 6.7x with frequent level-300 runaways. The streak is the one source that needs a fix (below).
- The simulated player dies about 10 times a year (death resets the run), so boss depth barely differs across scenarios; EXP income per week is the reliable signal.

**Calibration still to do**, after the `expGain` change below:

1. Re-run the simulation with the 25% level-based target and the fatter tail, and confirm that a boss-only run falls behind and that 1 quest/week closes most of the gap at mid levels.
2. `BASE_BOSS_EXP` (currently 33, cut from 40 for the old quest income) needs re-checking. Milestone and `expGain` EXP make up 21% of income at level 1 and 59-66% by level 20+, so cutting the boss base alone does not produce an even shortfall across levels.
3. Adjust `QUEST_TARGET_LEVEL_FRACTION` if skipped weeks cost too little or too much at the levels players spend most time at.

## Related change: `expGain` rebalance

A separate change, tracked here because it moves the calibration:

- Halve the `expGain` base stat in `TUNING.BASE_STATS` (12 to 6), which halves what an `expGain` skill and its streak add. By scaling the simulation by hand (not re-run), a 30-day streak falls from about 3.4x to about 2.2x of reference income and 60 days from about 6.7x to about 3.9x.
- The stat still grows exponentially with level (about 6% per level) while `expToNextLevel` grows only quadratically, so very long streaks at high level can still outrun the boss. Players doing really well outscaling the boss is acceptable, but a streak-multiplier cap is the real fix if it becomes a problem. Not in this pass.
- The tuning comment tying 12 to `0.3 * BASE_BOSS_EXP` must be updated.
- Existing in-progress characters have the old value baked into `starterStats.expGain`. Whether to cut it retroactively (as `applyDamagePoolRebalance` did for damage pools) or only for new characters is an open question.

## Data model

```ts
export interface Quest {
  id: string;
  kind: 'regular' | 'side';
  description: string;
  difficulty: Difficulty;
  dueDateKey: string;      // YYYY-MM-DD, required for every quest
  rewardItemId?: string;   // side quests only: the item paid out on completion
}
```

`bossIndexAtOffer` is removed. Regular quests no longer lock reward to the offering boss, because the reward is level-and-week based. `kind` defaults to `'regular'` when absent.

Weekly completion counter, stored with the character or in the quest slice (implementer's choice):

```ts
questWeek: { weekKey: string; completed: number }
```

On completion, if `weekKey !== weeklyPeriodKey(now)`, reset to `{ weekKey: current, completed: 0 }` before taking the slot. Only regular quests increment it.

## Due dates and misses

Unchanged from the 2026-10-04 spec and extended to both kinds:

- The due date is required, picked with the native date picker (`min` = today).
- A quest whose `dueDateKey` is strictly before today queues into the existing `useQuestMissGate` / `QuestMissPopup`, which has the "I actually did this" override.
- **Overridden:** resolves as a completion, using the weekly slot at the time of acknowledgement for regular quests, or the item for side quests.
- **Not overridden:** applies `questMissDamage` (existing formula: boss attack * miss factor * weekly miss multiplier * difficulty/1.5), runs the death check, writes a `quest-failed` log entry. The miss damage is the same for both kinds. The quest is removed either way.

The weekly slot for an overridden miss is taken when the player acknowledges, not on the due date. This is simpler and cannot be gamed much, since the slot only shrinks as the week fills.

## Side quests

- The existing `quest` event in `EVENT_DEFS` becomes the **side-quest** event. Picking it creates a side quest with a description, difficulty, and due date, same as the current form, plus a pre-assigned `rewardItemId`.
- **Run-exclusive items.** At character creation (and therefore on every death, since death produces a fresh Character) `TUNING.SIDE_QUEST_ITEM_COUNT` rare items are chosen at random from the droppable pool and flagged side-only. They are removed from normal boss-kill drops and the `item-drop` event for that run. Store the chosen ids on the Character (for example `sideOnlyItemIds`).
- **Guarantee.** A side-only item must be obtainable in a run. While any side-only item is still unobtained and unassigned to a pending side quest, the side-quest event is eligible, and `TUNING.SIDE_QUEST_GUARANTEE_LEVELS` caps how many level-up picks can pass without it being offered in the pick-1-of-3 (forced into the choices when the cap is hit).
- Completing a side quest on time grants its item through the existing item-drop popup path and clears the quest. No EXP, no counter change. Missing it deals miss damage and the item is returned to the unassigned side-only pool so it can be offered again.
- Item rarity and exact pool are item-system decisions (see `items.ts`).

## UI

- **Add quest:** a button in the Quest section opens the existing quest form (description, difficulty, required due date). No offer modal for regular quests.
- **Quest rows:** regular quests show a difficulty badge and due date; side quests show a distinct style and a small item icon. Checkbox completes it.
- **Detail view on tap:** description, difficulty, due date, and reward. Regular: "Small / Medium / Large EXP" from difficulty. Side: the item. Copy stays terse and mysterious per the player-facing text rule: no mention of slots, weeks, or the curve.
- The modal priority order (`useModalPriority`) loses the quest-offer step for regular quests; the side-quest pick still goes through the normal event-choice flow.

## Migration

- Existing saved quests become `kind: 'regular'` and keep their due dates; `bossIndexAtOffer` is dropped. Do it as an additive in-place migration (`migrateQuests`), no schema-version bump, matching the precedent for `migrateCharacter`.
- Existing `questExpReward` / `QUEST_EXP_DIFFICULTY_PCT` are replaced by the curve above and removed, not left as no-ops.
- Characters from before this change get `questWeek` initialized empty and `sideOnlyItemIds` empty (no retroactive flagging of items mid-run).

## Tuning constants

```ts
QUESTS_PER_WEEK_ON_CURVE: 1,             // any positive number; how many quests/week = baseline
QUEST_TARGET_LEVEL_FRACTION: 0.15,       // share of expToNextLevel(level) paid by a medium slot-1 quest (cut from 0.25 to 0.1 on 2026-10-22 with milestones at 0.25x after sims showed ~4x EXP, then raised to 0.15 so quests matter more)
QUEST_SLOT_WEIGHTS: [100, 60, 35, 20, 10, 5, 2],   // slot 8+ pays 0
QUEST_DIFFICULTY_MULT: { easy: 0.7, medium: 1.0, hard: 1.3 },
SIDE_QUEST_ITEM_COUNT: <TBD>,
SIDE_QUEST_GUARANTEE_LEVELS: <TBD>,
```

## Testing

- `quests.spec.ts`: slot rewards match the table at `N = 1, 1.5, 2, 3`; fractional `N` interpolates correctly; the 7-slot total is 232% at default and slot 8+ pays 0; reward equals `expToNextLevel(level) * fraction * weight` and is under one level at level 1; difficulty multipliers apply; weekly reset on a new `weeklyPeriodKey`; a missed quest does not consume a slot; side quests never change the counter or grant EXP.
- Property check: for any `N` in (0.5, 3] the first `N` slots sum to the weekly target.
- Due dates: creating a quest without a due date is rejected for both kinds; a past-due side quest and a past-due regular quest both queue into the miss gate and deal miss damage.
- Events: the side-quest event is ineligible when no side-only items remain; the guarantee forces it into the choices after `SIDE_QUEST_GUARANTEE_LEVELS` misses; a missed side quest returns its item to the pool.
- Items: flagged side-only items never appear in boss drops or the `item-drop` event.
- Migration: old quests load as regular with due dates intact; no schema bump.
- `expGain` base cut: character creation uses the new base; any retroactive migration (if chosen) is gated by a flag so it never double-applies.
- Calibration is checked by the simulation above, not by unit tests.

## Open questions

1. **Retroactive `expGain` cut:** apply to the current in-progress run via a one-time gated migration, or new characters only.
2. **Default fraction (0.25) and `N` (1)** are play-test knobs. If skipping quests early feels free, or late quests feel too large, tune `QUEST_TARGET_LEVEL_FRACTION` first.
3. **Side-quest miss penalty** uses the same formula as regular quests per "all quests take a hit". A separate multiplier is a one-line change if losing a side-only item chance feels too harsh.

## Out of scope

- No quest editing after creation.
- No per-quest streaks, recurring quests, or categories. Recurring tasks are what habits are for.
- No change to milestone EXP or EXP items.
- No streak-multiplier cap on `expGain` (noted above as the fix if needed).
- No UI mockups; styling stays within the existing utilitarian conventions.
