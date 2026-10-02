# Item Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second, more powerful tier of 19 items (flat stat bonuses, armor/magic penetration, player defense stats) that unlocks progressively by player level, with 6 equip slots at level 10 — no boss-side difficulty changes.

**Architecture:** `src/game-engine/items.ts` is the single source of truth for the item catalog and its lookup functions; everything else (combat math, the character store, UI) consumes it through the existing `itemBonusPercent`/new `itemFlatBonus` functions rather than reading raw item fields. `ItemDef` moves from a fixed primary/extra stat pair to an arbitrary-length `bonuses` array so multi-stat themed items fit without new fields per stat. Per-run randomness (which items unlock at which level) is rolled once in `createCharacter` and stored on `Character`, following the same pattern already used for `difficultyModifier` and the damage-split ratio.

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Vite + Pinia, Vitest for tests. No backend.

**Spec:** `docs/superpowers/specs/2026-10-02-item-overhaul-design.md`

## Global Constraints

- No boss difficulty changes — `boss.ts`, and `BOSS_GROWTH_RATE`/`BASE_BOSS_POWER`/the miss-damage curve constants in `tuning.ts`, are not touched by this plan.
- `generateBoss` does not read character/item state — confirmed unaffected since boss-side logic is untouched.
- Armor Pen / Magic Pen total from items is capped at `TUNING.ARMOR_MAGIC_PEN_CAP_PCT = 90` before reducing a boss's resist stat.
- Player armor/magicResist mitigation reuses the exact existing `applyResist`/`damageReductionPct` functions and `TUNING.RESIST_K` — no new resist constant.
- Flat stat bonuses apply before any percent multiplier (item %, streak, Special/Ult, Overdrive) — added into the level-scaled base stat, not tacked on after.
- The original 30 catalog items keep identical stats/rarities/behavior — this is a pure schema refactor for them, not a balance change.
- Existing save compatibility: new `Character.newItemUnlockTiers` field is optional (`?:`), matching this codebase's established pattern (`difficultyModifier?`, `statusEffects?`, `woundsAbility?` in `types.ts`) — an old save without it simply treats every level-gated item as locked until the player's next death naturally re-rolls a fresh character.

## Review Focus

- **Hybrid/multi-stat items displaying correctly** — `describeItemBonus` and `bodySpriteFor` must handle items with 3-4 bonus entries (e.g. Bloodthorn Blade), not just the old 2-entry max. Task 1 and Task 2 tests cover this.
- **Armor/Magic Pen stacking past the 90% cap** — a player equipping multiple pen items (e.g. Serrated Ripper + Piercing Fang Gauntlets + Duelist's Signet = 70%, still under cap, but a hypothetical stack over 90% must clamp, not go negative or invert). Task 6 tests this explicitly.
- **Boss lifesteal after player mitigation** — `missHabit`'s boss-lifesteal-heal must key off the *mitigated* damage the player actually took, not the pre-mitigation raw amount, or a geared-up defensive player would still heal the boss for more than they're actually being hurt. Task 7 tests this.
- **Level-gated items never appearing before their tier** — a fresh level-1 character must never see any of the 19 new items in a drop roll, even at a late boss index with a huge drop-count curve. Task 3 tests this at boss index 50.
- **Old saves with no `newItemUnlockTiers`** — `rollItemDrops` must not throw or accidentally unlock everything when `character.newItemUnlockTiers` is `undefined`; it must treat every level-gated item as locked. Task 3 tests this directly.

---

### Task 1: Restructure `ItemDef`/`BoostableStat` schema and migrate the existing 30-item catalog

**Files:**
- Modify: `src/game-engine/items.ts`
- Modify: `src/game-engine/items.spec.ts`
- Modify: `src/components/character/PlayerSprite.vue`
- Modify: `src/composables/useItemDropQueue.spec.ts`

**Interfaces:**
- Produces: `ItemBonus { stat: BoostableStat; percent?: number; flat?: number }`, `ItemDef.bonuses: ItemBonus[]` (replaces `stat`/`bonusPercent`/`extraStat`/`extraBonusPercent`), `itemFlatBonus(character: Character, stat: BoostableStat): number`, `BoostableStat` extended with `'armorPen' | 'magicPen' | 'armor' | 'magicResist'`.
- Consumes: nothing new — this task is a schema migration of existing exports (`itemBonusPercent`, `describeItemBonus`, `bodySpriteFor`, `ITEM_CATALOG`).

- [ ] **Step 1: Update the `ITEM_CATALOG` shape assertions in `items.spec.ts` to the new schema**

In `src/game-engine/items.spec.ts`, replace the `describe('ITEM_CATALOG', ...)` block (the one checking length/lifesteal/consumable/common-vs-rare/critChance/hybrid) with:

```ts
describe('ITEM_CATALOG', () => {
  it('has exactly 30 items with unique ids', () => {
    expect(ITEM_CATALOG).toHaveLength(30);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(30);
  });

  it('has at least one item granting lifesteal', () => {
    const lifestealItems = ITEM_CATALOG.filter((item) => item.bonuses.some((b) => b.stat === 'lifesteal'));
    expect(lifestealItems.length).toBeGreaterThan(0);
  });

  it('has exactly one consumable item: the Phoenix Feather', () => {
    const consumables = ITEM_CATALOG.filter((item) => item.type === 'consumable');
    expect(consumables).toHaveLength(1);
    expect(consumables[0].id).toBe('phoenix-feather');
  });

  it('has more common items than rare items', () => {
    const common = ITEM_CATALOG.filter((item) => item.rarity === 'common');
    const rare = ITEM_CATALOG.filter((item) => item.rarity === 'rare');
    expect(common.length).toBeGreaterThan(rare.length);
  });

  it('has at least one item granting critChance', () => {
    const critItems = ITEM_CATALOG.filter((item) => item.bonuses.some((b) => b.stat === 'critChance'));
    expect(critItems.length).toBeGreaterThan(0);
  });

  it('has at least one hybrid item granting both physicalDamage and magicDamage', () => {
    const hybrid = ITEM_CATALOG.filter(
      (item) =>
        item.bonuses.some((b) => b.stat === 'physicalDamage') && item.bonuses.some((b) => b.stat === 'magicDamage'),
    );
    expect(hybrid.length).toBeGreaterThan(0);
  });
});
```

This is step 1 of a refactor (not new-behavior TDD) — the test file is updated first so the next step's run shows it failing against the *old* schema, confirming the test actually exercises the new shape.

- [ ] **Step 2: Run the updated spec and confirm it fails against the old schema**

Run: `npx vitest run src/game-engine/items.spec.ts`
Expected: FAIL — TypeScript errors on `item.bonuses` not existing on the current `ItemDef`, plus the `toHaveLength(30)`/hybrid assertions failing once it does compile, since the old catalog doesn't have a `bonuses` field yet.

- [ ] **Step 3: Replace `BoostableStat`/`ItemDef` and the 30-item catalog in `items.ts`**

Replace lines 1-19 of `src/game-engine/items.ts` (the `BoostableStat` type through the `ItemDef` interface) with:

```ts
export type BoostableStat =
  | 'physicalDamage'
  | 'magicDamage'
  | 'healing'
  | 'health'
  | 'expGain'
  | 'critChance'
  | 'lifesteal'
  | 'armorPen' // percent only — reduces the boss's effective armor before its resist formula, see combat.ts
  | 'magicPen' // percent only — same, for magicResist
  | 'armor' // flat only — player mitigation stat, see combat.ts missHabit
  | 'magicResist'; // flat only — player mitigation stat, see combat.ts missHabit

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface ItemBonus {
  stat: BoostableStat;
  percent?: number;
  flat?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to an <img>/Sprite
  type: 'equipment' | 'consumable'; // consumables still occupy an equip slot, but grant no passive bonus
  rarity: ItemRarity; // rare items are weighted much lower in rollItemDrops
  bonuses: ItemBonus[]; // empty for the pure-consumable Phoenix Feather
  // Present only on the 19 items introduced in the 2026-10-02 item overhaul;
  // absent/falsy on the original 30. Gates this item out of rollItemDrops
  // until the character's rolled-for-this-run unlock tier (see
  // assignNewItemUnlockTiers) is at or below the character's level.
  levelGated?: true;
}
```

Then replace the `export const ITEM_CATALOG: ItemDef[] = [ ... ]` array (through its closing `];`, i.e. through what is currently line 176) with:

```ts
export const ITEM_CATALOG: ItemDef[] = [
  // --- Physical damage (common -> epic; the only stat-category with a 5-tier spread up to +50%) ---
  { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 3 }] },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 6 }] },
  { id: 'warlords-greatsword', name: "Warlord's Greatsword", icon: 'items/warlords-greatsword', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 12 }] },
  { id: 'executioners-axe', name: "Executioner's Axe", icon: 'items/executioners-axe', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 25 }] },
  { id: 'godslayer-greatblade', name: 'Godslayer Greatblade', icon: 'items/godslayer-greatblade', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'physicalDamage', percent: 50 }] },
  // --- Magic damage (common -> epic; mirrors the physical damage spread above) ---
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 3 }] },
  { id: 'arcane-staff', name: 'Arcane Staff', icon: 'items/arcane-staff', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'magicDamage', percent: 6 }] },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'magicDamage', percent: 12 }] },
  { id: 'stormcaller-staff', name: 'Stormcaller Staff', icon: 'items/stormcaller-staff', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 25 }] },
  { id: 'voidcallers-scepter', name: "Voidcaller's Scepter", icon: 'items/voidcallers-scepter', type: 'equipment', rarity: 'epic', bonuses: [{ stat: 'magicDamage', percent: 50 }] },
  // --- Healing (common) ---
  { id: 'novices-charm', name: "Novice's Charm", icon: 'items/novices-charm', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 3 }] },
  { id: 'blessed-censer', name: 'Blessed Censer', icon: 'items/blessed-censer', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'healing', percent: 6 }] },
  { id: 'sacred-chalice', name: 'Sacred Chalice', icon: 'items/sacred-chalice', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'healing', percent: 10 }] },
  // --- Health (common) ---
  { id: 'padded-vest', name: 'Padded Vest', icon: 'items/padded-vest', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 3 }] },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'health', percent: 6 }] },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'health', percent: 10 }] },
  // --- Exp gain (common) ---
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'items/lucky-coin', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 3 }] },
  { id: 'shining-star', name: 'Shining Star', icon: 'items/shining-star', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'expGain', percent: 6 }] },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'expGain', percent: 10 }] },
  // --- Crit chance (common) ---
  { id: 'lucky-dagger', name: 'Lucky Dagger', icon: 'items/lucky-dagger', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 2 }] },
  { id: 'assassins-edge', name: "Assassin's Edge", icon: 'items/assassins-edge', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'critChance', percent: 5 }] },
  { id: 'eagle-eye-lens', name: 'Eagle Eye Lens', icon: 'items/eagle-eye-lens', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'critChance', percent: 10 }] },
  // --- Hybrid physical + magic damage (common) ---
  { id: 'battlemage-gauntlets', name: 'Battlemage Gauntlets', icon: 'items/battlemage-gauntlets', type: 'equipment', rarity: 'common', bonuses: [{ stat: 'physicalDamage', percent: 4 }, { stat: 'magicDamage', percent: 4 }] },
  { id: 'runed-warblade', name: 'Runed Warblade', icon: 'items/runed-warblade', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'physicalDamage', percent: 8 }, { stat: 'magicDamage', percent: 8 }] },
  { id: 'chaos-blade', name: 'Chaos Blade', icon: 'items/chaos-blade', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 15 }, { stat: 'magicDamage', percent: 15 }] },
  // --- Rare multi-stat items (bigger swings, much rarer drops) ---
  { id: 'dragons-heart', name: "Dragon's Heart", icon: 'items/dragons-heart', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'health', percent: 20 }, { stat: 'physicalDamage', percent: 10 }] },
  { id: 'void-crystal', name: 'Void Crystal', icon: 'items/void-crystal', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'magicDamage', percent: 15 }, { stat: 'critChance', percent: 15 }] },
  { id: 'berserkers-fury', name: "Berserker's Fury", icon: 'items/berserkers-fury', type: 'equipment', rarity: 'rare', bonuses: [{ stat: 'physicalDamage', percent: 20 }, { stat: 'critChance', percent: 15 }] },
  // --- Lifesteal (uncommon) ---
  { id: 'vampiric-fang', name: 'Vampiric Fang', icon: 'items/vampiric-fang', type: 'equipment', rarity: 'uncommon', bonuses: [{ stat: 'lifesteal', percent: 5 }] },
  // --- Consumable ---
  { id: 'phoenix-feather', name: 'Phoenix Feather', icon: 'items/phoenix-feather', type: 'consumable', rarity: 'rare', bonuses: [] },
];
```

- [ ] **Step 4: Rewrite `itemBonusPercent`, add `itemFlatBonus`, rewrite `describeItemBonus` and `bodySpriteFor`**

Replace the current `itemBonusPercent` function with:

```ts
/**
 * Sums bonus.percent across every equipped item's `bonuses` entries matching
 * `stat`. 0 if none equipped/matching.
 */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const bonus of item.bonuses) {
      if (bonus.stat === stat && bonus.percent) total += bonus.percent;
    }
  }
  return total;
}

/**
 * Sums bonus.flat across every equipped item's `bonuses` entries matching
 * `stat`. 0 if none equipped/matching. See combat.ts/leveling.ts for where
 * this is added into a stat's level-scaled base before any percent
 * multiplier applies.
 */
export function itemFlatBonus(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (!item) continue;
    for (const bonus of item.bonuses) {
      if (bonus.stat === stat && bonus.flat) total += bonus.flat;
    }
  }
  return total;
}
```

Replace `describeItemBonus` with:

```ts
/** Human-readable summary of what an item grants, for popups/tooltips. */
export function describeItemBonus(item: ItemDef): string {
  if (item.type === 'consumable') return 'Consumable — grants one free revive on death, while equipped';
  const parts: string[] = [];
  for (const bonus of item.bonuses) {
    if (bonus.percent) parts.push(`+${bonus.percent}% ${bonus.stat}`);
    if (bonus.flat) parts.push(`+${bonus.flat} ${bonus.stat}`);
  }
  return parts.join(', ');
}
```

Replace `bodySpriteFor` with:

```ts
/**
 * The body-worn sprite layer (a path segment relative to public/sprites/)
 * for an equipped item, or null if it has no visual slot (not equipped, a
 * consumable, or a stat with no body-slot mapping). Uses the first bonus
 * entry that both maps to a body slot and carries a percent (flat-only
 * bonuses like armor/magicResist never render a body layer today).
 */
export function bodySpriteFor(item: ItemDef | null): string | null {
  if (!item) return null;
  const relevantBonus = item.bonuses.find((bonus) => bonus.stat in BODY_SLOT_BY_STAT && bonus.percent);
  if (!relevantBonus || !relevantBonus.percent) return null;
  const slot = BODY_SLOT_BY_STAT[relevantBonus.stat];
  const tier = tierForBonusPercent(relevantBonus.percent);
  if (!slot || !tier) return null;
  return `player/${slot}-${tier}`;
}
```

Leave `BODY_SLOT_BY_STAT`, `tierForBonusPercent`, `rarityWeightByBossIndex`, `weightedSampleWithoutReplacement`, and `rollItemDrops` untouched for this step — `rollItemDrops` still compiles against the new `ItemDef` shape unchanged since it never reads `.stat`/`.bonusPercent` directly.

- [ ] **Step 5: Update `PlayerSprite.vue`'s stat lookup**

In `src/components/character/PlayerSprite.vue`, replace:

```ts
function firstEquippedWithStat(stat: string) {
  return equippedItems.value.find((item) => item.stat === stat) ?? null;
}
```

with:

```ts
function firstEquippedWithStat(stat: string) {
  return equippedItems.value.find((item) => item.bonuses.some((bonus) => bonus.stat === stat)) ?? null;
}
```

- [ ] **Step 6: Update `useItemDropQueue.spec.ts`'s `makeItem` helper so the file still compiles**

In `src/composables/useItemDropQueue.spec.ts`, replace:

```ts
function makeItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'rusty-blade',
    name: 'Rusty Blade',
    icon: 'items/rusty-blade',
    type: 'equipment',
    rarity: 'common',
    stat: 'physicalDamage',
    bonusPercent: 3,
    ...overrides,
  };
}
```

with:

```ts
function makeItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'rusty-blade',
    name: 'Rusty Blade',
    icon: 'items/rusty-blade',
    type: 'equipment',
    rarity: 'common',
    bonuses: [{ stat: 'physicalDamage', percent: 3 }],
    ...overrides,
  };
}
```

The two call sites that pass `{ id: ..., stat: 'magicDamage' }`/`{ id: 'lucky-coin', stat: 'expGain' }` as overrides (in the "dismiss advances the queue" and "fills remaining slots" tests) need those overrides changed to `{ id: 'apprentice-wand', bonuses: [{ stat: 'magicDamage', percent: 3 }] }` and `{ id: 'lucky-coin', bonuses: [{ stat: 'expGain', percent: 3 }] }` respectively, so the override replaces the whole `bonuses` array rather than a now-nonexistent `stat` field.

- [ ] **Step 7: Add the `itemFlatBonus` baseline test to `items.spec.ts`**

Add this new `describe` block after the existing `describe('itemBonusPercent', ...)` block:

```ts
describe('itemFlatBonus', () => {
  it('returns 0 when nothing is equipped', () => {
    expect(itemFlatBonus(makeCharacter(), 'physicalDamage')).toBe(0);
  });

  it('returns 0 when equipped items have no flat bonus for that stat (none of the original 30 do)', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'battlemage-gauntlets'] });
    expect(itemFlatBonus(character, 'physicalDamage')).toBe(0);
  });
});
```

Add `itemFlatBonus` to the existing import line at the top of `items.spec.ts` (`import { bodySpriteFor, describeItemBonus, ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';` → add `itemFlatBonus` to that list).

- [ ] **Step 8: Run the full test suite and fix any remaining type errors**

Run: `npx vitest run`
Expected: All suites pass. If any other file fails to type-check because it references `item.stat`/`item.bonusPercent`/`item.extraStat`/`item.extraBonusPercent` directly, grep for those identifiers (`grep -rn "\.extraStat\|\.bonusPercent\|\.extraBonusPercent" --include="*.ts" --include="*.vue" src`) and update it the same way as Step 5 — there should be none left after Steps 1-7, since this was confirmed exhaustively before this plan was written.

- [ ] **Step 9: Commit**

```bash
git add src/game-engine/items.ts src/game-engine/items.spec.ts src/components/character/PlayerSprite.vue src/composables/useItemDropQueue.spec.ts
git commit -m "Restructure ItemDef to a bonuses array, migrating the existing 30-item catalog"
```

---

### Task 2: Add the 19 new level-gated items and `assignNewItemUnlockTiers`

**Files:**
- Modify: `src/game-engine/constants/tuning.ts`
- Modify: `src/game-engine/items.ts`
- Modify: `src/game-engine/items.spec.ts`

**Interfaces:**
- Consumes: `ItemDef`, `ItemBonus`, `BoostableStat`, `levelGated` (Task 1), `shuffle` (from `./rng`, already exported).
- Produces: `assignNewItemUnlockTiers(rng: Rng): Record<string, 10 | 15 | 20>`, 19 new catalog entries.

- [ ] **Step 1: Write the failing tests for the new items existing and for `assignNewItemUnlockTiers`**

Add to `src/game-engine/items.spec.ts`:

```ts
describe('ITEM_CATALOG — level-gated items', () => {
  it('has 49 total items: the original 30 plus 19 level-gated ones', () => {
    expect(ITEM_CATALOG).toHaveLength(49);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(49);
  });

  it('has exactly 19 items marked levelGated', () => {
    expect(ITEM_CATALOG.filter((item) => item.levelGated).length).toBe(19);
  });

  it('includes Bloodthorn Blade with its full 4-bonus theme', () => {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === 'bloodthorn-blade');
    expect(item).toBeDefined();
    expect(item?.levelGated).toBe(true);
    expect(item?.bonuses).toEqual([
      { stat: 'physicalDamage', flat: 100 },
      { stat: 'physicalDamage', percent: 10 },
      { stat: 'lifesteal', percent: 2 },
      { stat: 'armorPen', percent: 10 },
    ]);
  });

  it('includes Titans Lifeblood with a 1000 flat health bonus', () => {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === 'titans-lifeblood');
    expect(item?.bonuses).toEqual([
      { stat: 'health', flat: 1000 },
      { stat: 'healing', percent: 5 },
      { stat: 'lifesteal', percent: 5 },
    ]);
  });
});

describe('itemFlatBonus — with a real flat-bonus item', () => {
  it('sums a flat physicalDamage bonus from an equipped level-gated item', () => {
    const character = makeCharacter({ equippedItemIds: ['berserkers-war-axe'] });
    expect(itemFlatBonus(character, 'physicalDamage')).toBe(200);
  });
});

describe('assignNewItemUnlockTiers', () => {
  it('assigns every level-gated item id to exactly one of 10/15/20', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const levelGatedIds = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);
    expect(Object.keys(tiers).sort()).toEqual(levelGatedIds.sort());
    for (const id of levelGatedIds) {
      expect([10, 15, 20]).toContain(tiers[id]);
    }
  });

  it('splits 19 items into groups of 7/7/5 across tiers 10/15/20', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const counts = { 10: 0, 15: 0, 20: 0 };
    for (const tier of Object.values(tiers)) counts[tier] += 1;
    expect(counts[10]).toBe(7);
    expect(counts[15]).toBe(7);
    expect(counts[20]).toBe(5);
  });

  it('produces a different assignment for a different seed', () => {
    const tiersA = assignNewItemUnlockTiers(createRng(1));
    const tiersB = assignNewItemUnlockTiers(createRng(2));
    expect(tiersA).not.toEqual(tiersB);
  });
});
```

Add `assignNewItemUnlockTiers` to the `import { ... } from './items';` line at the top of `items.spec.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/items.spec.ts`
Expected: FAIL — `assignNewItemUnlockTiers` is not exported, the 49-item/19-levelGated counts fail against the current 30-item catalog, and the two new item-lookup tests find `undefined`.

- [ ] **Step 3: Add `ARMOR_MAGIC_PEN_CAP_PCT` to tuning.ts**

In `src/game-engine/constants/tuning.ts`, add this field to the `TUNING` object (after `WOUNDS_EFFECT_RATE_OPTIONS` and before `ITEM_DROP_EVERY_N_BOSSES` is a reasonable spot, but anywhere in the object works):

```ts
  // Total armorPen/magicPen percent from equipped items is clamped to this
  // before reducing a boss's effective armor/magicResist (see combat.ts) —
  // mirrors how CRIT_CHANCE_CAP keeps crit under 100%. A boss always
  // retains at least 10% of its true resist no matter how much pen is stacked.
  ARMOR_MAGIC_PEN_CAP_PCT: 90,
```

- [ ] **Step 4: Append the 19 new items to `ITEM_CATALOG` in `items.ts`**

Add these entries to the end of the `ITEM_CATALOG` array in `src/game-engine/items.ts`, immediately before the closing `];`:

```ts
  // --- Level-gated items (2026-10-02 item overhaul) — unlock tier per
  // character is randomized once per run by assignNewItemUnlockTiers, not
  // fixed here; levelGated just marks membership in that random pool. ---
  // Physical
  { id: 'berserkers-war-axe', name: "Berserker's War Axe", icon: 'items/berserkers-war-axe', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 200 }, { stat: 'lifesteal', percent: 5 }] },
  { id: 'serrated-ripper', name: 'Serrated Ripper', icon: 'items/serrated-ripper', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 150 }, { stat: 'armorPen', percent: 20 }] },
  { id: 'bloodthorn-blade', name: 'Bloodthorn Blade', icon: 'items/bloodthorn-blade', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'physicalDamage', flat: 100 }, { stat: 'physicalDamage', percent: 10 }, { stat: 'lifesteal', percent: 2 }, { stat: 'armorPen', percent: 10 }] },
  { id: 'piercing-fang-gauntlets', name: 'Piercing Fang Gauntlets', icon: 'items/piercing-fang-gauntlets', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'armorPen', percent: 30 }, { stat: 'physicalDamage', percent: 10 }, { stat: 'health', flat: 200 }] },
  // Magic
  { id: 'runeforged-spellblade', name: 'Runeforged Spellblade', icon: 'items/runeforged-spellblade', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'magicDamage', flat: 400 }, { stat: 'magicResist', flat: 100 }] },
  { id: 'chaos-conduit', name: 'Chaos Conduit', icon: 'items/chaos-conduit', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'magicDamage', percent: 30 }, { stat: 'magicPen', percent: 20 }] },
  { id: 'scholars-grimoire', name: "Scholar's Grimoire", icon: 'items/scholars-grimoire', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'magicDamage', flat: 100 }, { stat: 'magicPen', percent: 5 }, { stat: 'expGain', percent: 10 }] },
  // Defense
  { id: 'bulwark-plate', name: 'Bulwark Plate', icon: 'items/bulwark-plate', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'health', percent: 10 }, { stat: 'health', flat: 500 }] },
  { id: 'aegis-of-the-unbroken', name: 'Aegis of the Unbroken', icon: 'items/aegis-of-the-unbroken', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'health', flat: 200 }, { stat: 'health', percent: 20 }, { stat: 'armor', flat: 50 }, { stat: 'magicResist', flat: 50 }] },
  { id: 'juggernaut-carapace', name: 'Juggernaut Carapace', icon: 'items/juggernaut-carapace', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'armor', flat: 300 }, { stat: 'health', flat: 200 }] },
  { id: 'warding-sigil', name: 'Warding Sigil', icon: 'items/warding-sigil', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'health', percent: 10 }, { stat: 'magicResist', flat: 150 }] },
  // Support
  { id: 'serene-lotus-charm', name: 'Serene Lotus Charm', icon: 'items/serene-lotus-charm', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'healing', percent: 12 }, { stat: 'expGain', percent: 12 }] },
  { id: 'font-of-renewal', name: 'Font of Renewal', icon: 'items/font-of-renewal', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'healing', flat: 200 }, { stat: 'expGain', percent: 5 }] },
  { id: 'pilgrims-blessing', name: "Pilgrim's Blessing", icon: 'items/pilgrims-blessing', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'healing', flat: 100 }, { stat: 'health', percent: 5 }, { stat: 'expGain', percent: 5 }] },
  { id: 'adventurers-sigil', name: "Adventurer's Sigil", icon: 'items/adventurers-sigil', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'expGain', percent: 10 }, { stat: 'health', percent: 10 }, { stat: 'lifesteal', percent: 2 }, { stat: 'armor', flat: 100 }] },
  // Balanced
  { id: 'duelists-signet', name: "Duelist's Signet", icon: 'items/duelists-signet', type: 'equipment', rarity: 'rare', levelGated: true, bonuses: [{ stat: 'health', flat: 100 }, { stat: 'physicalDamage', flat: 50 }, { stat: 'armorPen', percent: 20 }, { stat: 'lifesteal', percent: 2 }] },
  { id: 'warded-longsword', name: 'Warded Longsword', icon: 'items/warded-longsword', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'armor', flat: 100 }, { stat: 'magicDamage', flat: 50 }] },
  { id: 'stalwart-sages-ring', name: "Stalwart Sage's Ring", icon: 'items/stalwart-sages-ring', type: 'equipment', rarity: 'uncommon', levelGated: true, bonuses: [{ stat: 'armor', flat: 50 }, { stat: 'magicResist', flat: 50 }, { stat: 'healing', percent: 5 }, { stat: 'health', percent: 5 }] },
  { id: 'titans-lifeblood', name: "Titan's Lifeblood", icon: 'items/titans-lifeblood', type: 'equipment', rarity: 'epic', levelGated: true, bonuses: [{ stat: 'health', flat: 1000 }, { stat: 'healing', percent: 5 }, { stat: 'lifesteal', percent: 5 }] },
```

- [ ] **Step 5: Add `assignNewItemUnlockTiers` to `items.ts`**

Add this near the bottom of `items.ts`, after `rollItemDrops` (it needs `ITEM_CATALOG` and `shuffle` in scope, both already available — add `shuffle` to the existing `import type { Rng } from './rng';` line, changing it to `import { shuffle, type Rng } from './rng';`):

```ts
// Computed once at module load from the catalog itself, so the level-gated
// set can never drift out of sync with which items actually carry `levelGated`.
const LEVEL_GATED_ITEM_IDS = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);

/**
 * Rolls this run's random unlock-tier assignment for every level-gated
 * item: shuffles the 19 ids, then chunks them via Math.ceil(n/3) into three
 * groups (7/7/5 for today's count) mapped to levels 10/15/20. Called once
 * per run, from createCharacter — see Task 3.
 */
export function assignNewItemUnlockTiers(rng: Rng): Record<string, 10 | 15 | 20> {
  const shuffled = shuffle(LEVEL_GATED_ITEM_IDS, rng);
  const chunkSize = Math.ceil(shuffled.length / 3);
  const tiers: Record<string, 10 | 15 | 20> = {};
  shuffled.forEach((id, i) => {
    tiers[id] = i < chunkSize ? 10 : i < chunkSize * 2 ? 15 : 20;
  });
  return tiers;
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npx vitest run src/game-engine/items.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game-engine/constants/tuning.ts src/game-engine/items.ts src/game-engine/items.spec.ts
git commit -m "Add 19 level-gated items and assignNewItemUnlockTiers"
```

---

### Task 3: `Character.newItemUnlockTiers`, wire into `createCharacter`, level-gate `rollItemDrops`

**Files:**
- Modify: `src/game-engine/types.ts`
- Modify: `src/game-engine/character.ts`
- Modify: `src/game-engine/character.spec.ts`
- Modify: `src/game-engine/items.ts`
- Modify: `src/game-engine/items.spec.ts`
- Modify: `src/game-engine/combat.spec.ts`
- Modify: `src/game-engine/leveling.spec.ts`

**Interfaces:**
- Consumes: `assignNewItemUnlockTiers` (Task 2).
- Produces: `Character.newItemUnlockTiers?: Record<string, 10 | 15 | 20>`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game-engine/character.spec.ts` (inside the existing `describe('createCharacter', ...)` block, alongside the other `it`s):

```ts
  it('rolls a newItemUnlockTiers assignment covering every level-gated item', () => {
    const character = createCharacter(createRng(1));
    const levelGatedIds = ITEM_CATALOG.filter((item) => item.levelGated).map((item) => item.id);
    expect(Object.keys(character.newItemUnlockTiers ?? {}).sort()).toEqual(levelGatedIds.sort());
  });
```

Add `import { ITEM_CATALOG } from './items';` to the top of `character.spec.ts`.

Add to `src/game-engine/items.spec.ts`, inside `describe('rollItemDrops', ...)`:

```ts
  it('never drops a level-gated item before the character reaches its assigned unlock level', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const lockedId = Object.keys(tiers).find((id) => tiers[id] > 1); // true for every id, since tiers are 10/15/20
    const character = makeCharacter({ level: 1, newItemUnlockTiers: tiers });
    for (let seed = 0; seed < 100; seed++) {
      const result = rollItemDrops(character, 50, createRng(seed)); // boss 50: max drop-count curve
      expect(result.map((item) => item.id)).not.toContain(lockedId);
    }
  });

  it('drops a level-gated item once the character reaches its assigned unlock level', () => {
    const tiers = assignNewItemUnlockTiers(createRng(1));
    const unlockedId = Object.keys(tiers)[0];
    const unlockLevel = tiers[unlockedId];
    const character = makeCharacter({ level: unlockLevel, newItemUnlockTiers: tiers, ownedItemIds: ITEM_CATALOG.filter((i) => i.id !== unlockedId).map((i) => i.id) });
    const result = rollItemDrops(character, 50, createRng(1));
    expect(result.map((item) => item.id)).toEqual([unlockedId]);
  });

  it('treats every level-gated item as locked when newItemUnlockTiers is undefined (old-save compatibility)', () => {
    const character = makeCharacter({ level: 20, newItemUnlockTiers: undefined });
    for (let seed = 0; seed < 50; seed++) {
      const result = rollItemDrops(character, 50, createRng(seed));
      expect(result.every((item) => !item.levelGated)).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/character.spec.ts src/game-engine/items.spec.ts`
Expected: FAIL — `newItemUnlockTiers` doesn't exist on `Character` yet (type error), and `rollItemDrops` doesn't filter by it.

- [ ] **Step 3: Add the field to `Character`**

In `src/game-engine/types.ts`, add to the `Character` interface (after `equippedItemIds`):

```ts
  // Rolled once per run by assignNewItemUnlockTiers (see character.ts),
  // mapping each level-gated item's id to the player level at which it
  // starts being droppable. Optional so an existing save (no schema-version
  // bump) still loads — undefined is treated as "every level-gated item is
  // locked" by rollItemDrops, same conservative-default pattern as
  // difficultyModifier?/statusEffects?/woundsAbility? elsewhere in this file.
  // The player's next death naturally re-rolls a fresh assignment.
  newItemUnlockTiers?: Record<string, 10 | 15 | 20>;
```

- [ ] **Step 4: Wire it into `createCharacter`**

In `src/game-engine/character.ts`, add the import `assignNewItemUnlockTiers` to the existing `import { ... } from './items';`-style import (currently `character.ts` doesn't import from `items.ts` at all — add a new import line: `import { assignNewItemUnlockTiers } from './items';`), and add the field to the returned object in `createCharacter`:

```ts
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    critChance: TUNING.BASE_CRIT_CHANCE,
    newItemUnlockTiers: assignNewItemUnlockTiers(rng),
  };
```

- [ ] **Step 5: Level-gate `rollItemDrops` in `items.ts`**

Replace the first line of `rollItemDrops` (`const unowned = ITEM_CATALOG.filter((item) => !character.ownedItemIds.includes(item.id));`) with:

```ts
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng): ItemDef[] {
  const droppablePool = ITEM_CATALOG.filter((item) => {
    if (!item.levelGated) return true;
    const unlockLevel = character.newItemUnlockTiers?.[item.id];
    return unlockLevel !== undefined && character.level >= unlockLevel;
  });
  const unowned = droppablePool.filter((item) => !character.ownedItemIds.includes(item.id));
```

(the rest of the function body — `desiredCount`, `count`, `rarityWeight`, the final `return` — is unchanged, just now operating on `unowned` derived from `droppablePool` instead of `ITEM_CATALOG` directly).

- [ ] **Step 6: Add `newItemUnlockTiers: {}` to the `makeCharacter` helpers in `items.spec.ts`, `combat.spec.ts`, and `leveling.spec.ts`**

In each of those three files' `makeCharacter` function, add `newItemUnlockTiers: {},` as a default field (before the `...overrides` spread), e.g.:

```ts
function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    critChance: 0.01,
    newItemUnlockTiers: {},
    ...overrides,
  };
}
```

This keeps every existing test's character level-gate-free by default (empty tiers map means every `levelGated` item is locked, matching "no items owned/assigned" — consistent with a fresh character in these isolated unit tests that don't care about the new catalog).

- [ ] **Step 7: Run the tests and verify they pass**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 8: Commit**

```bash
git add src/game-engine/types.ts src/game-engine/character.ts src/game-engine/character.spec.ts src/game-engine/items.ts src/game-engine/items.spec.ts src/game-engine/combat.spec.ts src/game-engine/leveling.spec.ts
git commit -m "Add Character.newItemUnlockTiers and level-gate rollItemDrops"
```

---

### Task 4: `maxEquipSlots` and wiring it through the store, drop queue, and UI

**Files:**
- Modify: `src/game-engine/items.ts`
- Modify: `src/game-engine/items.spec.ts`
- Modify: `src/store/characterStore.ts`
- Modify: `src/store/characterStore.spec.ts`
- Modify: `src/composables/useItemDropQueue.ts`
- Modify: `src/composables/useItemDropQueue.spec.ts`
- Modify: `src/components/ui/ItemDropPopup.vue`
- Modify: `src/components/character/CharacterPanel.vue`

**Interfaces:**
- Produces: `maxEquipSlots(level: number): number`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Add to `src/game-engine/items.spec.ts`:

```ts
describe('maxEquipSlots', () => {
  it('is 4 below level 10', () => {
    expect(maxEquipSlots(1)).toBe(4);
    expect(maxEquipSlots(9)).toBe(4);
  });

  it('is 6 at level 10 and above', () => {
    expect(maxEquipSlots(10)).toBe(6);
    expect(maxEquipSlots(20)).toBe(6);
  });
});
```

Add `maxEquipSlots` to the `items.spec.ts` import line.

Add to `src/store/characterStore.spec.ts`:

```ts
  it('allows a 6th item once the character is level 10', () => {
    const store = useCharacterStore();
    const owned = ['rusty-blade', 'steel-sword', 'apprentice-wand', 'arcane-staff', 'novices-charm', 'blessed-censer'];
    store.character = { ...store.character, level: 10, ownedItemIds: owned, equippedItemIds: owned.slice(0, 5) };

    store.equipItem('blessed-censer');

    expect(store.character.equippedItemIds).toHaveLength(6);
  });

  it('still refuses a 5th item below level 10', () => {
    const store = useCharacterStore();
    const owned = ['rusty-blade', 'steel-sword', 'apprentice-wand', 'arcane-staff', 'novices-charm'];
    store.character = { ...store.character, level: 9, ownedItemIds: owned, equippedItemIds: owned.slice(0, 4) };

    store.equipItem('novices-charm');

    expect(store.character.equippedItemIds).toHaveLength(4);
  });
```

Add to `src/composables/useItemDropQueue.spec.ts`:

```ts
  it('isFull reflects the level-10 6-slot cap, not the base 4', () => {
    const characterStore = useCharacterStore();
    const owned = ['rusty-blade', 'steel-sword', 'apprentice-wand', 'arcane-staff', 'novices-charm'];
    characterStore.character = { ...characterStore.character, level: 10, ownedItemIds: owned, equippedItemIds: owned };

    const { isFull } = useItemDropQueue();

    expect(isFull.value).toBe(false); // 5 equipped, cap is 6 at level 10
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/items.spec.ts src/store/characterStore.spec.ts src/composables/useItemDropQueue.spec.ts`
Expected: FAIL — `maxEquipSlots` isn't exported yet, and the store/composable still hardcode `4`.

- [ ] **Step 3: Add `maxEquipSlots` to `items.ts`**

Add near `assignNewItemUnlockTiers`:

```ts
/** 4 equip slots below level 10, 6 at level 10+. */
export function maxEquipSlots(level: number): number {
  return level >= 10 ? 6 : 4;
}
```

- [ ] **Step 4: Wire it into `characterStore.ts`**

In `src/store/characterStore.ts`, add `maxEquipSlots` to the existing `import { ... } from '../game-engine';` line, then change `equipItem`:

```ts
    equipItem(itemId: string) {
      const { ownedItemIds, equippedItemIds, level } = this.character;
      if (!ownedItemIds.includes(itemId)) return;
      if (equippedItemIds.includes(itemId)) return;
      if (equippedItemIds.length >= maxEquipSlots(level)) return;
      this.character = { ...this.character, equippedItemIds: [...equippedItemIds, itemId] };
    },
```

- [ ] **Step 5: Wire it into `useItemDropQueue.ts`**

In `src/composables/useItemDropQueue.ts`, the existing `import type { ItemDef } from '../game-engine';` line is type-only; `maxEquipSlots` is a value, so add a new line above it (matching `characterStore.ts`'s existing pattern of a separate value-import line alongside its own `import type` line from the same barrel): `import { maxEquipSlots } from '../game-engine';`. Then change:

```ts
  const isFull = computed(() => characterStore.character.equippedItemIds.length >= maxEquipSlots(characterStore.character.level));
```

- [ ] **Step 6: Update `ItemDropPopup.vue`'s hardcoded slot-count text**

In `src/components/ui/ItemDropPopup.vue`, add `maxEquipSlots` to the `import { describeItemBonus, ITEM_CATALOG } from '../../game-engine';` line, add a computed:

```ts
const slotCount = computed(() => maxEquipSlots(characterStore.character.level));
```

and change the template's `<p class="replace-prompt">Your 4 slots are full — choose one to replace, or drop the new item:</p>` to:

```html
<p class="replace-prompt">Your {{ slotCount }} slots are full — choose one to replace, or drop the new item:</p>
```

- [ ] **Step 7: Update `CharacterPanel.vue`'s equip grid to size dynamically**

In `src/components/character/CharacterPanel.vue`, add `maxEquipSlots` to the existing `import { ... } from '../../game-engine';` line. Replace the `equippedSlots` computed:

```ts
// Sized to the character's current level-dependent slot cap (4 below
// level 10, 6 at 10+), in whatever order they were equipped — empty ones
// render as blank grid cells rather than being compacted away, so the grid
// never visually shifts as items are gained/replaced.
const slotCount = computed(() => maxEquipSlots(character.value.level));
const equippedSlots = computed(() =>
  Array.from({ length: slotCount.value }, (_, i) => {
    const itemId = character.value.equippedItemIds[i];
    return itemId ? ITEM_CATALOG.find((item) => item.id === itemId) ?? null : null;
  }),
);
const gridRows = computed(() => Math.ceil(slotCount.value / 2));
```

Change the `.item-grid` element in the template to bind a dynamic height/row-count instead of the fixed `96px`/2-row CSS:

```html
<div class="item-grid" :style="{ gridTemplateRows: `repeat(${gridRows}, 1fr)`, height: `${gridRows * 46}px` }">
```

And in the `<style scoped>` block, remove the fixed `height: 96px;` and `grid-template-rows: repeat(2, 1fr);` lines from `.item-grid` (height and row count are now set inline per the computed above; width stays `96px` so the grid keeps matching the sprite's width and only grows taller for the 6-slot case):

```css
.item-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  width: 96px;
}
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 9: Manually verify the UI**

Run: `npm run dev`, open the app, use the existing "Skip to next day" debug button (or equivalent debug control already in this codebase — see `src/components/debug/SkipDayButton.vue`) enough times / grind enough EXP to reach level 10, and confirm the character panel's item grid grows to 3 rows (6 cells) without the sprite or the rest of the panel's layout breaking.

- [ ] **Step 10: Commit**

```bash
git add src/game-engine/items.ts src/game-engine/items.spec.ts src/store/characterStore.ts src/store/characterStore.spec.ts src/composables/useItemDropQueue.ts src/composables/useItemDropQueue.spec.ts src/components/ui/ItemDropPopup.vue src/components/character/CharacterPanel.vue
git commit -m "Add maxEquipSlots (4 -> 6 at level 10) and wire it through store/queue/UI"
```

---

### Task 5: Flat-before-percent ordering in `completeHabit` and `effectiveStat`

**Files:**
- Modify: `src/game-engine/combat.ts`
- Modify: `src/game-engine/leveling.ts`
- Modify: `src/game-engine/combat.spec.ts`
- Modify: `src/game-engine/leveling.spec.ts`

**Interfaces:**
- Consumes: `itemFlatBonus` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to `src/game-engine/combat.spec.ts`, inside `describe('completeHabit', ...)`, following this file's existing pattern of composing the expected value from the same real helper functions `completeHabit` itself uses (see the `statAtLevel`/`streakMultiplier`/`applyResist` composition in the existing tests just above) rather than hand-computed numbers:

```ts
  it('adds a flat item bonus into the stat pool before the streak multiplier, so the flat amount is also multiplied by streak', () => {
    const character = makeCharacter({ equippedItemIds: ['berserkers-war-axe'] }); // +200 flat physicalDamage, +5% lifesteal
    const habit = makeHabit({ damageType: 'physical', streakCount: 9 }); // bumps to streak 10 this completion
    const boss = makeBoss({ armor: 0, health: 10000 }); // armor 0 -> no reduction, easier to reason about

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage');
    const expectedDealt = statValue * streakMultiplier(10);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });
```

Add `itemFlatBonus` to the existing `import { ITEM_CATALOG } from './items';` line in `combat.spec.ts` (→ `import { ITEM_CATALOG, itemFlatBonus } from './items';`). `'berserkers-war-axe'` is already in `ITEM_CATALOG` from Task 2.

Add to `src/game-engine/leveling.spec.ts`, a new `describe` block:

```ts
describe('effectiveStat — flat item bonus', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      critChance: 0.01,
      newItemUnlockTiers: {},
      ...overrides,
    };
  }

  it('adds a flat health bonus before the percent health multiplier', () => {
    // juggernaut-carapace: +300 flat armor, +200 flat health (no percent health on this one)
    const character = makeCharacter({ equippedItemIds: ['juggernaut-carapace'] });
    expect(effectiveStat(character, 'health')).toBeCloseTo(50 + 200, 5);
  });

  it('applies the percent health multiplier on top of the flat-boosted base', () => {
    // bulwark-plate: +10% health, +500 flat health
    const character = makeCharacter({ equippedItemIds: ['bulwark-plate'] });
    expect(effectiveStat(character, 'health')).toBeCloseTo((50 + 500) * 1.1, 5);
  });
});
```

Add `ITEM_CATALOG`-dependent ids used here require no new import — `leveling.spec.ts` doesn't currently import `ITEM_CATALOG`, but this test doesn't need to either (it only passes item ids as strings into `equippedItemIds`, same as every other test in this file's pattern).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/combat.spec.ts src/game-engine/leveling.spec.ts`
Expected: FAIL — flat bonuses aren't added into the base stat yet, so the computed damage/health values don't match.

- [ ] **Step 3: Update `completeHabit` in `combat.ts`**

Add `itemFlatBonus` to the existing `import { itemBonusPercent, rollItemDrops } from './items';` line (→ `import { itemBonusPercent, itemFlatBonus, rollItemDrops } from './items';`).

Replace the line `const rawStat = statAtLevel(character.starterStats[statField], character.level);` (it appears twice in `combat.ts` — once in `habitDamageBreakdown`, once in `completeHabit`; update **both**) with:

```ts
  const rawStat = statAtLevel(character.starterStats[statField], character.level) + itemFlatBonus(character, statField);
```

- [ ] **Step 4: Update `effectiveStat` in `leveling.ts`**

Add `itemFlatBonus` to the existing `import { itemBonusPercent } from './items';` line (→ `import { itemBonusPercent, itemFlatBonus } from './items';`).

Replace:

```ts
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health',
): number {
  return statAtLevel(character.starterStats[stat], character.level) * itemStatMultiplier(character, stat);
}
```

with:

```ts
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health',
): number {
  const baseWithFlat = statAtLevel(character.starterStats[stat], character.level) + itemFlatBonus(character, stat);
  return baseWithFlat * itemStatMultiplier(character, stat);
}
```

Note this changes `effectiveStat` for **all four** stats (physicalDamage/magicDamage/healing/health), not just health — consistent with the spec's "flat-before-percent" rule applying uniformly, and harmless today since only health-category new items (and none of the original 30) carry a flat bonus on physicalDamage/magicDamage/healing via this particular call path (those go through `completeHabit`'s own `rawStat` line from Step 3, not through `effectiveStat` — `effectiveStat` is used by UI display code and the healing-cap calculation, not by the per-habit damage split).

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/game-engine/combat.ts src/game-engine/leveling.ts src/game-engine/combat.spec.ts src/game-engine/leveling.spec.ts
git commit -m "Apply flat item stat bonuses before percent multipliers"
```

---

### Task 6: Armor Pen / Magic Pen reducing boss resist in `completeHabit`

**Files:**
- Modify: `src/game-engine/combat.ts`
- Modify: `src/game-engine/combat.spec.ts`

**Interfaces:**
- Consumes: `itemBonusPercent` (existing), `TUNING.ARMOR_MAGIC_PEN_CAP_PCT` (Task 2).

- [ ] **Step 1: Write the failing tests**

No current catalog combination of armorPen/magicPen items sums past the 90% cap (the four armorPen items total 80% if all equipped; magicPen items total even less), so an integration test through `completeHabit` alone could never make the clamp actually engage. To keep that behavior genuinely tested rather than just asserted, extract the clamp+reduction into its own small exported function and unit-test it directly, in addition to integration-testing the real catalog items through `completeHabit`.

Add to `src/game-engine/combat.spec.ts`, inside `describe('completeHabit', ...)`. As with Task 5's test, these compose the expected value from the real helper functions (`statAtLevel`, `itemFlatBonus`, `itemStatMultiplier`, `streakMultiplier`, `applyResist`, and the new `effectiveResistAfterPen`) rather than hand-computed numbers — each item used here carries its *own* flat/percent stat bonus alongside its pen bonus (e.g. Serrated Ripper also grants +150 flat physicalDamage), which the expected-value composition must account for or the test would be wrong:

```ts
  it('reduces the boss resist stat by the equipped armorPen percent before applying it, for a physical habit', () => {
    const character = makeCharacter({ equippedItemIds: ['serrated-ripper'] }); // +150 flat physicalDamage, +20% armorPen
    const habit = makeHabit({ damageType: 'physical', streakCount: 0 });
    const boss = makeBoss({ armor: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage');
    const amount = statValue * itemStatMultiplier(character, 'physicalDamage') * streakMultiplier(1);
    const expectedEffectiveArmor = effectiveResistAfterPen(boss.armor, itemBonusPercent(character, 'armorPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveArmor);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });

  it('sums armorPen across multiple equipped items before applying the cap', () => {
    // serrated-ripper (+150 flat physicalDamage, 20% armorPen) + piercing-fang-gauntlets (30% armorPen, +10%
    // physicalDamage, +200 flat health) + duelists-signet (+100 flat health, +50 flat physicalDamage, 20%
    // armorPen, +2% lifesteal) = 70% total armorPen, still under the 90% cap.
    const character = makeCharacter({ equippedItemIds: ['serrated-ripper', 'piercing-fang-gauntlets', 'duelists-signet'] });
    const habit = makeHabit({ damageType: 'physical', streakCount: 0 });
    const boss = makeBoss({ armor: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.physicalDamage, character.level) + itemFlatBonus(character, 'physicalDamage');
    const amount = statValue * itemStatMultiplier(character, 'physicalDamage') * streakMultiplier(1);
    const expectedEffectiveArmor = effectiveResistAfterPen(boss.armor, itemBonusPercent(character, 'armorPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveArmor);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });

  it('applies magicPen (not armorPen) for a magic habit', () => {
    const character = makeCharacter({ equippedItemIds: ['chaos-conduit'] }); // +30% magicDamage, +20% magicPen
    const habit = makeHabit({ damageType: 'magic', streakCount: 0 });
    const boss = makeBoss({ magicResist: 1000 });

    const result = completeHabit(character, habit, [habit], boss, DAY_KEY, noCritRng);

    const statValue = statAtLevel(character.starterStats.magicDamage, character.level) + itemFlatBonus(character, 'magicDamage');
    const amount = statValue * itemStatMultiplier(character, 'magicDamage') * streakMultiplier(1);
    const expectedEffectiveResist = effectiveResistAfterPen(boss.magicResist, itemBonusPercent(character, 'magicPen'));
    const expectedDealt = applyResist(amount, expectedEffectiveResist);
    expect(result.damageDealt).toBeCloseTo(expectedDealt, 10);
  });
```

Add a new top-level `describe` block to the same file for the extracted pure function:

```ts
describe('effectiveResistAfterPen', () => {
  it('reduces resist by the pen percent when under the cap', () => {
    expect(effectiveResistAfterPen(1000, 20)).toBeCloseTo(800, 5);
  });

  it('returns the resist stat unchanged at 0% pen', () => {
    expect(effectiveResistAfterPen(1000, 0)).toBe(1000);
  });

  it('clamps pen at ARMOR_MAGIC_PEN_CAP_PCT even when given a percent far past it', () => {
    expect(effectiveResistAfterPen(1000, 150)).toBeCloseTo(1000 * (1 - TUNING.ARMOR_MAGIC_PEN_CAP_PCT / 100), 5);
  });
});
```

Add `effectiveResistAfterPen` to the `import { ... } from './combat';` line at the top of `combat.spec.ts`. Add `itemBonusPercent` to the `import { ITEM_CATALOG, itemFlatBonus } from './items';` line (→ `import { ITEM_CATALOG, itemBonusPercent, itemFlatBonus } from './items';`). Add `itemStatMultiplier` to the `import { addExpAndResolveLevelUps, effectiveStat, statAtLevel } from './leveling';` line (→ `import { addExpAndResolveLevelUps, effectiveStat, itemStatMultiplier, statAtLevel } from './leveling';`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/combat.spec.ts`
Expected: FAIL — `effectiveResistAfterPen` isn't exported yet, and `completeHabit`'s `damageDealt` reflects the boss's full, un-reduced resist.

- [ ] **Step 3: Add `effectiveResistAfterPen` and apply it in `completeHabit`**

In `src/game-engine/combat.ts`, add this new exported function near the top (e.g. just above `completeHabit`):

```ts
/**
 * The boss resist stat actually used against an attack, after clamping the
 * character's armorPen/magicPen percent to TUNING.ARMOR_MAGIC_PEN_CAP_PCT
 * and reducing resistStat by that percent. Exported (and unit-tested)
 * separately from completeHabit because no current item combination in the
 * catalog sums past the cap, so an integration test alone could never
 * exercise the clamp actually engaging.
 */
export function effectiveResistAfterPen(resistStat: number, penPct: number): number {
  const cappedPenPct = Math.min(penPct, TUNING.ARMOR_MAGIC_PEN_CAP_PCT);
  return resistStat * (1 - cappedPenPct / 100);
}
```

Then replace:

```ts
  const wasCrit = rng() < effectiveCritChance(character);
  const critAmount = wasCrit ? amount * TUNING.CRIT_MULTIPLIER : amount;
  const resistStat = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
  const dealt = applyResist(critAmount, resistStat);
```

with:

```ts
  const wasCrit = rng() < effectiveCritChance(character);
  const critAmount = wasCrit ? amount * TUNING.CRIT_MULTIPLIER : amount;
  const resistStat = habit.damageType === 'physical' ? boss.armor : boss.magicResist;
  const penStat = habit.damageType === 'physical' ? 'armorPen' : 'magicPen';
  const effectiveResistStat = effectiveResistAfterPen(resistStat, itemBonusPercent(character, penStat));
  const dealt = applyResist(critAmount, effectiveResistStat);
```

(`itemBonusPercent` is already imported in `combat.ts` from the Task 5 change — no new import needed here.)

- [ ] **Step 4: Add `effectiveResistAfterPen` to the game-engine barrel**

In `src/game-engine/index.ts`, add `effectiveResistAfterPen` to the existing `export { activeWoundsEffect, bossMissDamage, completeHabit, ... } from './combat';` list, keeping it alphabetically placed among the others.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/game-engine/combat.ts src/game-engine/combat.spec.ts src/game-engine/index.ts
git commit -m "Apply armor/magic pen to reduce boss resist, capped at ARMOR_MAGIC_PEN_CAP_PCT"
```

---

### Task 7: Player armor/magicResist mitigation in `missHabit`

**Files:**
- Modify: `src/game-engine/combat.ts`
- Modify: `src/game-engine/combat.spec.ts`

**Interfaces:**
- Consumes: `itemFlatBonus` (Task 1), `applyResist` (existing, from `./boss`, already imported in `combat.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/game-engine/combat.spec.ts`, inside `describe('missHabit', ...)` (find the existing describe block for `missHabit` and add these within it — if the rng needs to force a specific `attackType`, follow the existing pattern in this file for forcing crit via a fixed-return rng function):

`bossMissDamage`'s doc comment defines it as the damage dealt on a missed **medium** daily habit specifically (medium's `DIFFICULTY_WEIGHT / 1.5` cancels to exactly 1) — every `makeHabit({ difficulty: 'medium' })` override below is required for the `bossMissDamage(...)` expected-value shortcut to be valid; `makeHabit()`'s own default is `'easy'`, which would silently scale the expected value wrong if omitted.

```ts
  it('mitigates physical miss damage through equipped armor, using the same resist formula as boss armor', () => {
    const character = makeCharacter({ equippedItemIds: ['juggernaut-carapace'] }); // +300 flat armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0 });
    const forcePhysicalNoCrit = () => 0.4; // < 0.5 picks 'physical'; also beats critChance 0 and any woundsAbility roll
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack); // medium difficulty, no crit, no weekly multiplier
    const expectedMitigated = applyResist(rawDamage, 300);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(expectedMitigated, 5);
  });

  it('mitigates magic miss damage through equipped magicResist, not armor', () => {
    const character = makeCharacter({ equippedItemIds: ['warding-sigil'] }); // +150 flat magicResist, no armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ magicAttack: 1000, critChance: 0 });
    const forceMagicNoCrit = () => 0.6; // >= 0.5 picks 'magic'
    const result = missHabit(character, habit, boss, DAY_KEY, forceMagicNoCrit);

    const rawDamage = bossMissDamage(boss.magicAttack);
    const expectedMitigated = applyResist(rawDamage, 150);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(expectedMitigated, 5);
  });

  it('boss lifesteal heals off the mitigated damage, not the raw pre-mitigation amount', () => {
    const character = makeCharacter({ equippedItemIds: ['juggernaut-carapace'] }); // +300 flat armor
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0, lifestealPct: 1, maxHealth: 100000, health: 100 });
    const forcePhysicalNoCrit = () => 0.4;
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack);
    const expectedMitigated = applyResist(rawDamage, 300);
    // lifestealPct 1 (100%) means the boss heals for exactly the mitigated amount, not the larger raw amount.
    expect(result.bossLifestealHealed).toBeCloseTo(expectedMitigated, 5);
  });

  it('with no armor/magicResist equipped, mitigation is a no-op (matches pre-overhaul behavior)', () => {
    const character = makeCharacter();
    const habit = makeHabit({ difficulty: 'medium' });
    const boss = makeBoss({ physicalAttack: 1000, critChance: 0 });
    const forcePhysicalNoCrit = () => 0.4;
    const result = missHabit(character, habit, boss, DAY_KEY, forcePhysicalNoCrit);

    const rawDamage = bossMissDamage(boss.physicalAttack);
    expect(character.currentHealth - result.character.currentHealth).toBeCloseTo(rawDamage, 5);
  });
```

`bossMissDamage` and `applyResist` must be imported at the top of `combat.spec.ts` — `applyResist` is already imported (from `./boss`); add `bossMissDamage` to the `import { ... } from './combat';` line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game-engine/combat.spec.ts`
Expected: FAIL — the first three new tests see full, unmitigated damage/lifesteal; the fourth (no-armor no-op) already passes today, confirming it's a true regression guard once the others are implemented.

- [ ] **Step 3: Apply mitigation in `missHabit`**

In `src/game-engine/combat.ts`, replace:

```ts
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_MISS_MULTIPLIER : 1;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1) * weeklyMultiplier;
  const newHealth = Math.max(0, character.currentHealth - damage);
  const healedBoss = Math.min(boss.maxHealth, boss.health + damage * boss.lifestealPct);
  const bossLifestealHealed = healedBoss - boss.health;
  const newBoss = healedBoss !== boss.health ? { ...boss, health: healedBoss } : boss;
```

with:

```ts
  const weeklyMultiplier = habit.period === 'weekly' ? TUNING.WEEKLY_MISS_MULTIPLIER : 1;
  const damage =
    attack * TUNING.MISS_DAMAGE_FACTOR * (DIFFICULTY_WEIGHT[habit.difficulty] / 1.5) *
    (wasCrit ? TUNING.CRIT_MULTIPLIER : 1) * weeklyMultiplier;
  const playerResistStat = attackType === 'physical' ? itemFlatBonus(character, 'armor') : itemFlatBonus(character, 'magicResist');
  const mitigatedDamage = applyResist(damage, playerResistStat);
  const newHealth = Math.max(0, character.currentHealth - mitigatedDamage);
  const healedBoss = Math.min(boss.maxHealth, boss.health + mitigatedDamage * boss.lifestealPct);
  const bossLifestealHealed = healedBoss - boss.health;
  const newBoss = healedBoss !== boss.health ? { ...boss, health: healedBoss } : boss;
```

(`itemFlatBonus` is already imported in `combat.ts` from Task 5; `applyResist` is already imported from `./boss` at the top of this file.)

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run`
Expected: All suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/game-engine/combat.ts src/game-engine/combat.spec.ts
git commit -m "Mitigate missHabit damage through player armor/magicResist; boss lifesteal keys off mitigated amount"
```

---

## Final check

After Task 7's commit, run the full suite once more (`npx vitest run`) and `npm run build` (runs `vue-tsc -b`, catching any lingering type error across `.vue` files the targeted greps above might have missed) before considering this plan complete.
