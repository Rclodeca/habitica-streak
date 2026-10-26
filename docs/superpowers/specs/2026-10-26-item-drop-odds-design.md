# Item drop odds — Design Spec

Status as of 2026-10-26. Item drops get one progression rule: each rarity's share of drops is set by the player's level. The hidden level gates go away (the random 10/15/20 unlock groups and the fixed level-30 set), so every droppable item can drop from level 1. Every relic can be offered from level 1. Magpie's Diamond doubles rare and epic odds instead of rolling "as if from a boss 10 levels later".

No UI changes except Magpie's effect text, so no mockup is needed.

## Why

Two systems did the same job, "better items later", and they were out of sync:

- **Hidden level gates.** 28 items unlock at a random L10, L15 or L20 per run, and 5 more at a fixed L30. The player can't see which group unlocked, and drops are already random, so the variety barely shows.
- **Boss-number rarity curve.** Per-item weights start at 125:25:5:1 (common:uncommon:rare:epic) and are equal from boss 20 on. L15 arrives around boss 17 and L20 around boss 21, so the odds have almost evened out before the last gated groups join.
- **After boss 20, rarity stops meaning anything.** An epic is as likely as a common, and commons stay in the pool forever, so many late drops are commons nobody equips.
- **The weights are per item.** A tier's odds grow with how many items it has (rare has 31 items today, common 16), so adding items to a tier quietly makes the whole tier more common.

Other games we looked at: Brotato (higher tiers start appearing at set waves, then get more likely) is the closest model. Slay the Spire and Hades let everything appear from the start.

## Goals

- One rule for drop progression, tied to the number the player sees: their level.
- Late drops are always worth a look: commons fade out and stop dropping at L30.
- Epics stay special: they never become as common as commons were early.
- A tier's drop share doesn't depend on how many items it has. Adding an item only changes how often you see repeats inside its tier.
- Magpie's Diamond stays useful for the whole run.

## Non-goals

- Changing how many items a kill drops. The step curve on boss number (`ITEM_DROP_EVERY_N_BOSSES`, `ITEM_DROP_MAX_COUNT`) stays.
- Changing any item's stats. Starfall Staff and Worldbreaker Maul keep their numbers and stay the strongest epics. Dragon's Heart (a bit weak for a rare) is left alone.
- Pity timers, guaranteed drops, or showing the odds to the player.
- Changing how side quests offer or pay relics, beyond the unlock level.
- Re-tuning the odds with a simulation. The table below is a starting point.

## Anti-goals

- **Any hidden gate on drops.** If an item can drop, it can drop at any level, at its rarity's odds.
- **Drawbacks on new or changed items.** The three items moving to epic keep their stats as they are.
- Explaining the odds in player-facing copy. Item effect text is the one exception: it states plainly what the item does.

## Confirmed decisions

### Drop odds by level

Each rarity's share of drops, by player level:

| Level | Common | Uncommon | Rare | Epic |
|---|---|---|---|---|
| 1 | 75% | 22% | 3% | 0% |
| 5 | 55% | 33% | 11% | 1% |
| 10 | 30% | 40% | 25% | 5% |
| 20 | 10% | 40% | 38% | 12% |
| 30+ | 0% | 35% | 48% | 17% |

- Between rows, blend linearly by level. For example, L15 is 20 / 40 / 31.5 / 8.5 and L25 is 5 / 37.5 / 43 / 14.5. Every level from 30 up uses the L30 row.
- Use the character's level at the moment of the roll. For a boss kill that is the level after the kill's EXP, since `resolveBossDefeatIfDead` already passes the leveled character to `rollItemDrops`.
- The level replaces boss number for rarity. Boss number still sets how many items drop.

### How a drop is picked

For each item a kill drops:

1. Take the shares for the player's level (with Magpie applied, below).
2. Skip any rarity with no unowned items left. Scale the remaining shares back up to 100%.
3. Roll a rarity from those shares.
4. Pick one unowned item of that rarity, every item equally likely.

A multi-item kill repeats this, and an item picked earlier in the same kill counts as owned. This replaces the per-item weights (`rarityWeightByBossIndex`, `INITIAL_RARITY_WEIGHT`, `EQUAL_RARITY_WEIGHT`, `RARITY_CONVERGENCE_BOSS`).

A rarity at 0% can't drop at that level (epic at exactly L1, common from L30). If the only unowned items left are in 0% rarities, nothing drops.

### No level gates

- Remove `levelGated` and `unlockLevel` from `ItemDef` and from every catalog entry.
- Remove `assignNewItemUnlockTiers`, `backfillUnlockTiers`, `LEVEL_GATED_ITEM_IDS`, and their exports from `src/game-engine/index.ts`.
- Remove `newItemUnlockTiers` from `Character` (`types.ts`) and from `createCharacter`.
- `unownedDroppableItems` keeps only three checks: not a relic, not owned, and its rarity's share isn't 0% at the player's level (see **My calls**).

### The former level-30 items are epic

- Colossus Plate, Archon's Crown and Frostpiercer Crossbow move from rare to epic. Their stats stay the same, with no signature effect. Not every epic needs one.
- Starfall Staff and Worldbreaker Maul are already epic and don't change.
- After the move: 16 common, 17 uncommon, 28 rare, 14 epic, 15 relic (90 items).
- No other item changes tier. That came out of a tier review on 2026-10-25.

### Relics from level 1

- Every relic can be offered by a side quest from level 1. That includes the ones at L15 today (Headsman's Axe, Hunter's Eye, Moonwell Staff, Dynamo Rod, Banner of Endurance) and at L30 (Null Mirror, Echoing Blade, Glass Crown).
- `availableRelics` drops its level check. Everything else about relics stays the same.

### Magpie's Diamond

- Double the rare and epic shares, then scale all four back to 100%. Examples:
  - L1: rare goes from 3% to 5.8%.
  - L10: rare goes from 25% to 38.5%, and epic from 5% to 7.7%.
  - L30: rare goes from 48% to 58.2%, and epic from 17% to 20.6%.
- Replace `MAGPIE_BOSS_INDEX_BONUS: 10` with a multiplier of 2 in `TUNING.ITEM_EFFECTS`.
- New effect text: "Rare and epic items drop twice as often."
- Its stats (+8% crit chance, +3% lifesteal) don't change.

### Existing saves

- `migrateCharacter` deletes `newItemUnlockTiers` from a loaded save, the same way it already deletes `sideOnlyItemIds`. It no longer backfills tiers.
- A run in progress keeps every item it owns. All droppable items join its pool at once, at the odds for its current level.
- Remove the one-time compensating drop for saves from before level gates: `missedGatedItems` and `backfilledDrops` in `src/store/index.ts`, and the `enqueueDrops(backfilledDrops)` call in `src/main.ts`.
- No schema version bump. The change only removes a field.

## Tests

Rewrite the item tests that cover gating, and add tests for:

- **The odds table:** exact values at L1, L5, L10, L20 and L30, a blended level (L15), L45 matching L30, shares adding up to 100%, and the Magpie values above. These are easiest to test through a small function that returns the shares for a level, rather than through dice rolls.
- **Rolls:** no epic at L1 and no common at L30 across many seeds; when a rarity is fully owned, its share moves to the others; nothing drops when only 0% rarities are left; no relic ever drops; no repeats within a kill.
- **Catalog:** 90 items, the tier counts above, no `levelGated` or `unlockLevel` left, and the three moved items marked epic.
- **Relics:** every relic is available at L1.
- **Migration:** a save that has `newItemUnlockTiers` loads without it. Remove the store test for the old compensating drop.
- **Fixtures:** the leveling, combat, itemEffects, items and store specs set `newItemUnlockTiers`. The mocked catalog in `bossSkills.relics.spec.ts` sets `unlockLevel`. The side-quest tests in `events.spec.ts` depend on relic unlock levels. All of these need updating. The new roll draws from the RNG twice per item (rarity, then item), so seeded tests that expect specific drops may change.

## Docs and comments

- Rewrite the unlock-group comment at the top of `itemCatalog.ts`. Most epics carry a signature effect, but some are stat-only.
- The `BOSS_PERSONALITY_WEIGHTS` comment in `tuning.ts` points at the item rarity ratio. Reword it so it stands on its own. The weights themselves don't change.
- `scripts/item-catalog-page.ts` groups the page by unlock group. Group it by rarity instead, drop the relic level tag, and regenerate `docs/mockups/item-catalog.html` with `npm run item-catalog-page`.
- Leave older specs as they are, since they're history.

## My calls

These weren't discussed with the user. Change any of them if they look wrong:

- Drops roll a rarity first, then pick an item within it (above). This is what makes a tier's share independent of its size.
- A 0% rarity counts as not droppable everywhere, including in `unownedDroppableItems`. Then the "Find an item" event (`isEligible` in `events.ts`) can't be offered when its roll would come up empty.
- Remove the old-save compensating drop instead of keeping it alive for saves that no longer exist.

## Left to the builder

- Where the table lives: in `TUNING` next to the other drop constants, or in `items.ts`.
- Function names and how the code is split up.
- How the catalog entries are regrouped and commented now that the unlock groups are gone.
