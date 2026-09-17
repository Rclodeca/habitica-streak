# Items / Equipment / Gear — Design Spec

Status as of 2026-09-16. Implements the piece of `Seed task.txt` (lines 14, 16-19, 34) that `docs/plan.md` explicitly deferred: "4 item slots to Equip items... Dropped randomly from bosses on death... Each item gives a random effect... First boss only drop 1 item, later bosses drop more."

## Context

The MVP core loop (character/habits/boss combat/streaks/leveling/death-reset) is built and playable (see `PROGRESS.md`). `Character`/`Boss` types carry `// TODO: items` placeholder comments marking where this subsystem attaches. This spec fills that gap.

## Confirmed product decisions

- **Slots are interchangeable**, not typed. Any owned item fits in any of the 4 equip slots — no weapon/armor/accessory taxonomy. `equippedItemIds: string[]`, capped at length 4.
- **Curated catalog, not procedural generation.** 15 fixed items, 3 per stat category (physical damage, magic damage, healing, health, exp gain), each a fixed `{name, icon, bonusPercent}` — not randomly rolled on drop.
- **Each catalog item is unique per character.** Once owned, it's removed from that character's future drop pool. A fresh character (post-death) gets a fresh, full pool.
- **Distinct icon per item**, sourced from `HabitRPG/habitica-images` shop-preview icons (`gear/*/shop/shop_*.png` — clean standalone square icons, not the body-worn layered sprites). Same CC-BY-NC-SA 3.0 license as the boss sprites; extend `CREDITS.md`.

## Data model

`src/game-engine/types.ts` — `Character` gains two fields, replacing the `// TODO: items` comment:

```ts
export interface Character {
  level: number;
  exp: number;
  starterStats: { physicalDamage: number; magicDamage: number; healing: number; health: number };
  currentHealth: number;
  ownedItemIds: string[];    // all items ever dropped for this character (equipped + unequipped)
  equippedItemIds: string[]; // subset of ownedItemIds, length <= 4
}
```

`Boss`'s `// TODO: items — lootTable` comment is deleted, not implemented — drops come from one global catalog/pool shared by all bosses, not a per-boss table. Simpler, and matches the seed spec's "many items" (not "many items per boss").

## `src/game-engine/items.ts` (new module)

```ts
export type BoostableStat = 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'expGain';

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to Sprite.vue
  stat: BoostableStat;
  bonusPercent: number;
}
```

### Catalog (15 items, 3 tiers × 5 stats)

| id | name | stat | bonusPercent | icon |
|---|---|---|---|---|
| `rusty-blade` | Rusty Blade | physicalDamage | 3 | `items/rusty-blade` |
| `steel-sword` | Steel Sword | physicalDamage | 6 | `items/steel-sword` |
| `warlords-greatsword` | Warlord's Greatsword | physicalDamage | 10 | `items/warlords-greatsword` |
| `apprentice-wand` | Apprentice Wand | magicDamage | 3 | `items/apprentice-wand` |
| `arcane-staff` | Arcane Staff | magicDamage | 6 | `items/arcane-staff` |
| `archmages-rod` | Archmage's Rod | magicDamage | 10 | `items/archmages-rod` |
| `novices-charm` | Novice's Charm | healing | 3 | `items/novices-charm` |
| `blessed-censer` | Blessed Censer | healing | 6 | `items/blessed-censer` |
| `sacred-chalice` | Sacred Chalice | healing | 10 | `items/sacred-chalice` |
| `padded-vest` | Padded Vest | health | 3 | `items/padded-vest` |
| `chainmail-hauberk` | Chainmail Hauberk | health | 6 | `items/chainmail-hauberk` |
| `plate-armor` | Plate Armor | health | 10 | `items/plate-armor` |
| `lucky-coin` | Lucky Coin | expGain | 3 | `items/lucky-coin` |
| `shining-star` | Shining Star | expGain | 6 | `items/shining-star` |
| `rebirth-orb` | Rebirth Orb | expGain | 10 | `items/rebirth-orb` |

Icon source mapping (for the implementer pulling files into `public/sprites/items/`):

| icon file | habitica-images source |
|---|---|
| `rusty-blade.png` | `gear/weapon/shop/shop_weapon_warrior_1.png` |
| `steel-sword.png` | `gear/weapon/shop/shop_weapon_warrior_3.png` |
| `warlords-greatsword.png` | `gear/weapon/shop/shop_weapon_warrior_5.png` |
| `apprentice-wand.png` | `gear/weapon/shop/shop_weapon_wizard_1.png` |
| `arcane-staff.png` | `gear/weapon/shop/shop_weapon_wizard_3.png` |
| `archmages-rod.png` | `gear/weapon/shop/shop_weapon_wizard_5.png` |
| `novices-charm.png` | `gear/weapon/shop/shop_weapon_healer_1.png` |
| `blessed-censer.png` | `gear/weapon/shop/shop_weapon_healer_3.png` |
| `sacred-chalice.png` | `gear/weapon/shop/shop_weapon_healer_5.png` |
| `padded-vest.png` | `gear/armor/shop/shop_armor_warrior_1.png` |
| `chainmail-hauberk.png` | `gear/armor/shop/shop_armor_warrior_3.png` |
| `plate-armor.png` | `gear/armor/shop/shop_armor_warrior_5.png` |
| `lucky-coin.png` | `misc/Pet_Currency_Gem.png` |
| `shining-star.png` | `misc/seafoam_star.png` |
| `rebirth-orb.png` | `misc/rebirth_orb.png` |

### Functions

```ts
/** Sums bonusPercent across equipped items matching `stat`. 0 if none equipped. */
export function itemBonusPercent(character: Character, stat: BoostableStat): number;

/**
 * Rolls this character's item drop for defeating the boss at `bossIndex`.
 * Drop count = min(1 + floor((bossIndex - 1) / ITEM_DROP_EVERY_N_BOSSES), ITEM_DROP_MAX_COUNT),
 * further capped by however many catalog items this character doesn't already own.
 * Picks that many unique items at random (via `rng`, no replacement) from the
 * unowned subset of ITEM_CATALOG. Returns [] once the character owns all 15.
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng): ItemDef[];
```

New tuning constants (`constants/tuning.ts`):
```ts
ITEM_DROP_EVERY_N_BOSSES = 3
ITEM_DROP_MAX_COUNT = 3
```
So bosses 1-3 drop 1 item, 4-6 drop 2, 7-9+ drop 3 (capped), each further capped by the remaining unowned pool (0 once all 15 are owned — no error, just an empty drop).

`rollItemDrops` needs an unweighted "pick N unique from a list" — add a small `shuffle<T>(items: T[], rng: Rng): T[]` (Fisher-Yates) to `rng.ts` and take the first N of the shuffled unowned list. Reusable if a future feature needs random-without-replacement.

## Stat integration

New export in `src/game-engine/leveling.ts` (not `items.ts`, to avoid a circular import — `leveling.ts` already depends on nothing that would depend back on it, and `items.ts` stays a pure catalog/lookup module with no dependency on `leveling.ts`):

```ts
/** statAtLevel(...) scaled by the character's equipped-item bonus for `stat`. */
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health',
): number {
  const base = statAtLevel(character.starterStats[stat], character.level);
  return base * (1 + itemBonusPercent(character, stat) / 100);
}
```

`addExpAndResolveLevelUps` is modified to apply the `expGain` bonus internally, before the level-up loop:
```ts
export function addExpAndResolveLevelUps(character: Character, expGained: number) {
  const boostedExp = expGained * (1 + itemBonusPercent(character, 'expGain') / 100);
  // ...existing loop, using boostedExp instead of expGained
}
```
This guarantees every exp grant (streak milestones, boss-kill rewards, and any future caller) gets the item bonus automatically — no call site can forget it.

### Call sites to update (replace raw `statAtLevel(character.starterStats[x], character.level)` with `effectiveStat(character, x)`)

| File | Current call | Change |
|---|---|---|
| `game-engine/combat.ts` (`completeHabit`) | `statAtLevel(character.starterStats[DAMAGE_TYPE_STARTER_STAT[habit.damageType]], character.level)` for the damage-split stat value | → `effectiveStat(character, DAMAGE_TYPE_STARTER_STAT[habit.damageType])` |
| `game-engine/combat.ts` (`completeHabit`, healing cap) | `statAtLevel(character.starterStats.health, character.level)` | → `effectiveStat(character, 'health')` |
| `components/character/CharacterPanel.vue` | `maxHealth` computed | → `effectiveStat(character, 'health')` |
| `components/character/CharacterStatsModal.vue` | `physicalDamage`/`magicDamage`/`healing`/`maxHealth` computeds | → `effectiveStat(character, ...)` for all four |
| `components/habits/HabitStatsModal.vue` | `statValue` computed | → `effectiveStat(character, statField)` |

No other call sites read `starterStats` directly (confirmed via repo grep).

## Drop + equip flow

`resolveBossDefeatIfDead` (`combat.ts`) gains item-drop resolution alongside its existing exp/level-up logic:

```ts
export function resolveBossDefeatIfDead(character: Character, boss: Boss, rng: Rng): {
  character: Character; boss: Boss; defeated: boolean; levelsGained: number; itemsDropped: ItemDef[];
} {
  if (boss.health > 0) return { character, boss, defeated: false, levelsGained: 0, itemsDropped: [] };
  const { character: leveled, levelsGained } = addExpAndResolveLevelUps(character, bossExpReward(boss.index));
  const itemsDropped = rollItemDrops(leveled, boss.index, rng);
  const withItems = { ...leveled, ownedItemIds: [...leveled.ownedItemIds, ...itemsDropped.map((i) => i.id)] };
  return { character: withItems, boss: generateBoss(boss.index + 1, rng), defeated: true, levelsGained, itemsDropped };
}
```

`useCombatActions.ts`'s `checkOffHabit` already destructures this result to apply `character`/`boss`. Change its signature from `void` to `ItemDef[]` — return `defeatResult.itemsDropped` when a defeat occurred, `[]` otherwise (covers both "no boss defeat this call" and "defeat happened but the drop pool was already exhausted"). The caller (the checkbox click handler in `HabitListItem.vue`) reads this return value and, if non-empty, pushes each item's name onto the toast queue described below.

**Character store** (`characterStore.ts`) gains two actions:
```ts
equipItem(itemId: string): void   // no-op if not owned, already equipped, or already at 4 equipped
unequipItem(itemId: string): void // no-op if not currently equipped
```

`createCharacter` (`character.ts`) initializes `ownedItemIds: []`, `equippedItemIds: []`. Because `resolvePlayerDeathIfDead` calls `createCharacter(rng)` for the fresh character, death naturally wipes items — consistent with "everything resets" and it replenishes the drop pool for the new run.

## UI

- **`InventoryModal.vue`** (new, `components/character/`): opened via a new small button in `CharacterPanel.vue`'s header (separate from the existing click-anywhere-on-panel-to-open-stats behavior, so the two don't fight). Lists every owned item — icon, name, stat, `+N%`, and an equip/unequip toggle button — plus an "X/4 equipped" counter. Disables further equipping once at 4.
- **Loot toast**: a small queue of dismissing banners in `App.vue` (e.g. "Found: Steel Sword!"), populated whenever `checkOffHabit` reports non-empty `itemsDropped`. Auto-removes each entry after ~3s via `setTimeout`, matching the existing debounce/timeout pattern already used in this codebase (`localStoragePersistence.ts`, `useDamagePopup.ts`). No new dependency.
- **`CharacterStatsModal.vue`**: add a section listing currently-equipped items (name + `+N%` stat), so item effects are visible from the stats view, not just the inventory modal.

## Testing

- `game-engine/items.spec.ts` (new): `itemBonusPercent` sums correctly across multiple equipped items on the same stat, returns 0 for none equipped; `rollItemDrops` respects the drop-count curve at various boss indices, never returns owned items, returns fewer than the curve's count (down to 0) as the pool depletes, and never returns duplicates within one roll.
- `game-engine/leveling.spec.ts`: add cases for `effectiveStat` with 0/1/N equipped items on the relevant stat; add a case confirming `addExpAndResolveLevelUps` scales `expGained` by the equipped `expGain` bonus.
- `game-engine/combat.spec.ts`: update existing `completeHabit`/`resolveBossDefeatIfDead` tests to account for the new fields; add cases for damage/healing changing with equipped items, and for `itemsDropped` being populated (and capped/empty at pool exhaustion) on defeat.
- `store/characterStore.spec.ts` (new, or extend an existing store spec if one already covers this store): `equipItem`/`unequipItem` — ownership checks, the 4-slot cap, idempotency of double-equip/double-unequip.
- No new component (`.vue`) tests — consistent with this project's existing coverage boundary (game-engine + composables + store only).

## Deliberately out of scope (YAGNI, not requested)

- No slot-type restrictions (interchangeable slots only, per confirmed decision).
- No item rarity tiers, flavor text, or set bonuses beyond the flat `bonusPercent`.
- No "sell"/"discard" mechanic for owned items — inventory only grows, capped naturally at 15 total.
- No animation for the loot toast beyond a simple fade/dismiss (matches the plain CSS-transition bar used elsewhere, not the shake/float-fade combat-hit style).
