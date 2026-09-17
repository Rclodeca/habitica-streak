# Items / Equipment / Gear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deferred items/equipment/gear subsystem — 4 interchangeable equip slots, a curated 15-item catalog that drops off boss kills, stat bonuses that flow into existing combat/leveling math, and the UI to view/equip/unequip items.

**Architecture:** A new pure `game-engine/items.ts` module (catalog + bonus/drop math, zero Vue/Pinia deps, matching every other `game-engine` module). Existing `statAtLevel` call sites across `combat.ts` and three `.vue` components are replaced by a new `effectiveStat()` in `leveling.ts` that layers the item bonus on top — one formula, no drift. `characterStore` gains plain equip/unequip actions. A small shared "loot toast" composable surfaces drops in the UI.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`) + TypeScript + Pinia + Vitest — same stack as the rest of the repo, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-16-items-equipment-design.md`

## Global Constraints

- `game-engine/*.ts` stays pure TypeScript — zero imports from `vue` or `pinia`. Every module has a colocated `*.spec.ts`.
- Any function using randomness takes an injected `rng: Rng` (`() => number`) parameter — never `Math.random()` directly inside `game-engine`.
- All tunable numeric constants live in `src/game-engine/constants/tuning.ts`.
- Consumers (Pinia stores, composables, UI) import game-engine exports from the `src/game-engine/index.ts` barrel, never by reaching into individual modules.
- Slots are interchangeable (no slot-type taxonomy). Catalog is curated (15 fixed items, not procedural). Each catalog item is unique per character (removed from that character's drop pool once owned; a fresh post-death character gets a full pool again). Icons are distinct per item, sourced from `HabitRPG/habitica-images` shop-preview icons (CC-BY-NC-SA 3.0 — extend `CREDITS.md`).
- No component (`.vue`) tests — this project's existing coverage boundary is `game-engine` + `composables` + `store` only.
- Build directly on `main`, commit after each task (no feature branch/PR set up for this repo).

---

### Task 1: Tuning constants + `rng.ts` shuffle helper

**Files:**
- Modify: `src/game-engine/constants/tuning.ts`
- Modify: `src/game-engine/rng.ts`
- Modify: `src/game-engine/rng.spec.ts`
- Modify: `src/game-engine/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TUNING.ITEM_DROP_EVERY_N_BOSSES: number`, `TUNING.ITEM_DROP_MAX_COUNT: number`, `shuffle<T>(items: T[], rng: Rng): T[]` — Task 2's `rollItemDrops` needs both.

- [ ] **Step 1: Write the failing test for `shuffle`**

Add to `src/game-engine/rng.spec.ts` (new `describe` block, after the existing `pickWeighted` block):

```ts
describe('shuffle', () => {
  it('returns an array with the same elements (order may differ)', () => {
    const rng = createRng(5);
    const result = shuffle([1, 2, 3, 4, 5], rng);
    expect(result).toHaveLength(5);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input array', () => {
    const rng = createRng(5);
    const input = [1, 2, 3, 4, 5];
    shuffle(input, rng);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a given seed', () => {
    const resultA = shuffle([1, 2, 3, 4, 5], createRng(123));
    const resultB = shuffle([1, 2, 3, 4, 5], createRng(123));
    expect(resultA).toEqual(resultB);
  });

  it('produces a different order than the input across most seeds', () => {
    let differentCount = 0;
    for (let seed = 0; seed < 50; seed++) {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = shuffle(input, createRng(seed));
      if (!result.every((value, i) => value === input[i])) differentCount += 1;
    }
    expect(differentCount).toBeGreaterThan(40);
  });
});
```

Also update the top import line to include `shuffle`:
```ts
import { createRng, pickWeighted, shuffle } from './rng';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- rng.spec.ts`
Expected: FAIL — `shuffle` is not exported from `./rng`.

- [ ] **Step 3: Implement `shuffle` in `rng.ts`**

Add to the end of `src/game-engine/rng.ts`:

```ts
/** Fisher-Yates shuffle. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [ ] **Step 4: Add the two tuning constants**

In `src/game-engine/constants/tuning.ts`, add two keys to the `TUNING` object (anywhere among the existing keys, e.g. after `HABIT_DAMAGE_TYPE_WEIGHTS`):

```ts
  ITEM_DROP_EVERY_N_BOSSES: 3, // bosses 1-3 drop 1 item, 4-6 drop 2, 7+ drop 3 (capped)
  ITEM_DROP_MAX_COUNT: 3,
```

- [ ] **Step 5: Export `shuffle` from the barrel**

In `src/game-engine/index.ts`, change:
```ts
export { createRng, pickWeighted } from './rng';
```
to:
```ts
export { createRng, pickWeighted, shuffle } from './rng';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit -- --run`
Expected: PASS, all tests including the 4 new `shuffle` cases.

- [ ] **Step 7: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/game-engine/constants/tuning.ts src/game-engine/rng.ts src/game-engine/rng.spec.ts src/game-engine/index.ts
git commit -m "Add item-drop tuning constants and an rng shuffle helper"
```

---

### Task 2: Item catalog module (`items.ts`)

**Files:**
- Create: `src/game-engine/items.ts`
- Create: `src/game-engine/items.spec.ts`
- Modify: `src/game-engine/index.ts`

**Interfaces:**
- Consumes: `TUNING.ITEM_DROP_EVERY_N_BOSSES`, `TUNING.ITEM_DROP_MAX_COUNT` (Task 1); `shuffle`, `Rng` from `./rng`; `Character` from `./types` (already has `ownedItemIds`/`equippedItemIds` as of Task 3 — see note below).
- Produces: `type BoostableStat`, `interface ItemDef { id, name, icon, stat, bonusPercent }`, `ITEM_CATALOG: ItemDef[]` (15 entries), `itemBonusPercent(character, stat): number`, `rollItemDrops(character, bossIndex, rng): ItemDef[]`. Task 4 (`leveling.ts`) and Task 5 (`combat.ts`) both import from here.

**Note on ordering:** this task references `character.ownedItemIds`/`character.equippedItemIds`, which don't exist on `Character` until Task 3. That's fine — `items.ts`'s functions only need the *type* to compile, and this task's own tests build their own `Character`-shaped fixture objects with those fields already present (the fixture is written correctly from the start, even though `Character` itself isn't updated until Task 3). If you run this task's tests before Task 3, TypeScript will report `ownedItemIds`/`equippedItemIds` as excess/unknown properties on the fixture — that's expected and resolves itself once Task 3 lands. **Do Task 3 before Task 2 if executing out of order; if executing in the order given here, do Task 3 immediately after this one and don't run the full suite in between.**

- [ ] **Step 1: Write the failing tests**

Create `src/game-engine/items.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TUNING } from './constants/tuning';
import { ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';
import { createRng } from './rng';
import type { Character } from './types';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  const starterStats = { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 };
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
    ...overrides,
  };
}

describe('ITEM_CATALOG', () => {
  it('has exactly 15 items, 3 per stat category, with unique ids', () => {
    expect(ITEM_CATALOG).toHaveLength(15);
    expect(new Set(ITEM_CATALOG.map((item) => item.id)).size).toBe(15);

    const byStat: Record<string, number> = {};
    for (const item of ITEM_CATALOG) {
      byStat[item.stat] = (byStat[item.stat] ?? 0) + 1;
    }
    expect(byStat).toEqual({ physicalDamage: 3, magicDamage: 3, healing: 3, health: 3, expGain: 3 });
  });
});

describe('itemBonusPercent', () => {
  it('returns 0 when nothing is equipped', () => {
    expect(itemBonusPercent(makeCharacter(), 'physicalDamage')).toBe(0);
  });

  it('sums bonusPercent across multiple equipped items matching the stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'steel-sword'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3 + 6);
  });

  it('ignores equipped items that do not match the requested stat', () => {
    const character = makeCharacter({ equippedItemIds: ['rusty-blade', 'apprentice-wand'] });
    expect(itemBonusPercent(character, 'physicalDamage')).toBe(3);
    expect(itemBonusPercent(character, 'magicDamage')).toBe(3);
    expect(itemBonusPercent(character, 'healing')).toBe(0);
  });
});

describe('rollItemDrops', () => {
  it('drops exactly 1 item for boss index 1 when the pool is full', () => {
    expect(rollItemDrops(makeCharacter(), 1, createRng(1))).toHaveLength(1);
  });

  it('drops more items for later boss indices, following the step curve', () => {
    const character = makeCharacter();
    expect(rollItemDrops(character, 1, createRng(1))).toHaveLength(1);
    expect(rollItemDrops(character, TUNING.ITEM_DROP_EVERY_N_BOSSES + 1, createRng(1))).toHaveLength(2);
    expect(rollItemDrops(character, TUNING.ITEM_DROP_EVERY_N_BOSSES * 2 + 1, createRng(1))).toHaveLength(3);
  });

  it('caps drop count at ITEM_DROP_MAX_COUNT even for very high boss indices', () => {
    const result = rollItemDrops(makeCharacter(), 1000, createRng(1));
    expect(result.length).toBeLessThanOrEqual(TUNING.ITEM_DROP_MAX_COUNT);
  });

  it('never drops an already-owned item, and shrinks the count as the pool depletes', () => {
    const owned = ITEM_CATALOG.slice(0, 13).map((item) => item.id); // 2 remain unowned
    const character = makeCharacter({ ownedItemIds: owned });
    const result = rollItemDrops(character, 50, createRng(1)); // curve wants 3, only 2 remain
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(owned).not.toContain(item.id);
    }
  });

  it('returns [] once every catalog item is owned', () => {
    const character = makeCharacter({ ownedItemIds: ITEM_CATALOG.map((item) => item.id) });
    expect(rollItemDrops(character, 50, createRng(1))).toEqual([]);
  });

  it('never returns duplicate items within a single roll', () => {
    const result = rollItemDrops(makeCharacter(), 50, createRng(7));
    const ids = result.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- items.spec.ts`
Expected: FAIL — `./items` does not exist yet.

- [ ] **Step 3: Implement `items.ts`**

Create `src/game-engine/items.ts`:

```ts
import { TUNING } from './constants/tuning';
import { shuffle } from './rng';
import type { Rng } from './rng';
import type { Character } from './types';

export type BoostableStat = 'physicalDamage' | 'magicDamage' | 'healing' | 'health' | 'expGain';

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // path segment relative to public/sprites/, passed straight to an <img>/Sprite
  stat: BoostableStat;
  bonusPercent: number;
}

export const ITEM_CATALOG: ItemDef[] = [
  { id: 'rusty-blade', name: 'Rusty Blade', icon: 'items/rusty-blade', stat: 'physicalDamage', bonusPercent: 3 },
  { id: 'steel-sword', name: 'Steel Sword', icon: 'items/steel-sword', stat: 'physicalDamage', bonusPercent: 6 },
  {
    id: 'warlords-greatsword',
    name: "Warlord's Greatsword",
    icon: 'items/warlords-greatsword',
    stat: 'physicalDamage',
    bonusPercent: 10,
  },
  { id: 'apprentice-wand', name: 'Apprentice Wand', icon: 'items/apprentice-wand', stat: 'magicDamage', bonusPercent: 3 },
  { id: 'arcane-staff', name: 'Arcane Staff', icon: 'items/arcane-staff', stat: 'magicDamage', bonusPercent: 6 },
  { id: 'archmages-rod', name: "Archmage's Rod", icon: 'items/archmages-rod', stat: 'magicDamage', bonusPercent: 10 },
  { id: 'novices-charm', name: "Novice's Charm", icon: 'items/novices-charm', stat: 'healing', bonusPercent: 3 },
  { id: 'blessed-censer', name: 'Blessed Censer', icon: 'items/blessed-censer', stat: 'healing', bonusPercent: 6 },
  { id: 'sacred-chalice', name: 'Sacred Chalice', icon: 'items/sacred-chalice', stat: 'healing', bonusPercent: 10 },
  { id: 'padded-vest', name: 'Padded Vest', icon: 'items/padded-vest', stat: 'health', bonusPercent: 3 },
  { id: 'chainmail-hauberk', name: 'Chainmail Hauberk', icon: 'items/chainmail-hauberk', stat: 'health', bonusPercent: 6 },
  { id: 'plate-armor', name: 'Plate Armor', icon: 'items/plate-armor', stat: 'health', bonusPercent: 10 },
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'items/lucky-coin', stat: 'expGain', bonusPercent: 3 },
  { id: 'shining-star', name: 'Shining Star', icon: 'items/shining-star', stat: 'expGain', bonusPercent: 6 },
  { id: 'rebirth-orb', name: 'Rebirth Orb', icon: 'items/rebirth-orb', stat: 'expGain', bonusPercent: 10 },
];

/** Sums bonusPercent across the character's equipped items matching `stat`. 0 if none equipped/matching. */
export function itemBonusPercent(character: Character, stat: BoostableStat): number {
  let total = 0;
  for (const id of character.equippedItemIds) {
    const item = ITEM_CATALOG.find((candidate) => candidate.id === id);
    if (item && item.stat === stat) total += item.bonusPercent;
  }
  return total;
}

/**
 * Rolls this character's item drop for defeating the boss at `bossIndex`.
 * Desired count follows a step curve (more items from later bosses, capped
 * at ITEM_DROP_MAX_COUNT), further capped by how many catalog items this
 * character doesn't already own — returns [] once every item is owned.
 */
export function rollItemDrops(character: Character, bossIndex: number, rng: Rng): ItemDef[] {
  const unowned = ITEM_CATALOG.filter((item) => !character.ownedItemIds.includes(item.id));
  const desiredCount = Math.min(
    1 + Math.floor((bossIndex - 1) / TUNING.ITEM_DROP_EVERY_N_BOSSES),
    TUNING.ITEM_DROP_MAX_COUNT,
  );
  const count = Math.min(desiredCount, unowned.length);
  return shuffle(unowned, rng).slice(0, count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- items.spec.ts`
Expected: PASS (once Task 3's `Character` type update has also landed — see the ordering note above; if Task 3 hasn't landed yet you'll see a type error on the fixture, not a test failure).

- [ ] **Step 5: Export from the barrel**

In `src/game-engine/index.ts`, add:
```ts
export type { BoostableStat, ItemDef } from './items';
export { ITEM_CATALOG, itemBonusPercent, rollItemDrops } from './items';
```

- [ ] **Step 6: Commit**

```bash
git add src/game-engine/items.ts src/game-engine/items.spec.ts src/game-engine/index.ts
git commit -m "Add curated 15-item catalog with bonus/drop math"
```

---

### Task 3: `Character` gains item fields; schema version bump

**Files:**
- Modify: `src/game-engine/types.ts`
- Modify: `src/game-engine/character.ts`
- Modify: `src/game-engine/character.spec.ts`
- Modify: `src/game-engine/combat.spec.ts` (fixture only)
- Modify: `src/game-engine/leveling.spec.ts` (fixture only)
- Modify: `src/store/plugins/saveState.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Character.ownedItemIds: string[]`, `Character.equippedItemIds: string[]` — every later task relies on these existing.

- [ ] **Step 1: Write the failing test**

Add to `src/game-engine/character.spec.ts`, inside the `describe('createCharacter', ...)` block (after the existing `'starts at level 1...'` test):

```ts
  it('starts with no owned or equipped items', () => {
    const character = createCharacter(createRng(1));
    expect(character.ownedItemIds).toEqual([]);
    expect(character.equippedItemIds).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- character.spec.ts`
Expected: FAIL — `character.ownedItemIds` is `undefined`, `toEqual([])` fails (or a type error, since `Character` doesn't declare the field yet).

- [ ] **Step 3: Update the `Character`/`Boss` types**

In `src/game-engine/types.ts`, replace:
```ts
// TODO: items — equippedItems: ItemSlot[4] once equipment is implemented
export interface Character {
  level: number;
  exp: number;
  starterStats: {
    physicalDamage: number;
    magicDamage: number;
    healing: number;
    health: number;
  };
  currentHealth: number;
}
```
with:
```ts
export interface Character {
  level: number;
  exp: number;
  starterStats: {
    physicalDamage: number;
    magicDamage: number;
    healing: number;
    health: number;
  };
  currentHealth: number;
  ownedItemIds: string[]; // all items ever dropped for this character (equipped + unequipped)
  equippedItemIds: string[]; // subset of ownedItemIds, length <= 4
}
```

And replace:
```ts
// TODO: items — lootTable once item drops are implemented
export interface Boss {
```
with:
```ts
export interface Boss {
```
(No other change to `Boss` — drops come from one global catalog/pool via `items.ts`, not a per-boss loot table.)

- [ ] **Step 4: Update `createCharacter`**

In `src/game-engine/character.ts`, replace the `createCharacter` function body's `return` statement:
```ts
  return { level: 1, exp: 0, starterStats, currentHealth: starterStats.health };
```
with:
```ts
  return {
    level: 1,
    exp: 0,
    starterStats,
    currentHealth: starterStats.health,
    ownedItemIds: [],
    equippedItemIds: [],
  };
```

- [ ] **Step 5: Fix the existing fixtures so the suite still compiles**

In `src/game-engine/combat.spec.ts`, update `makeCharacter`:
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
    ...overrides,
  };
}
```

In `src/game-engine/leveling.spec.ts`, update `makeCharacter` (inside `describe('addExpAndResolveLevelUps', ...)`):
```ts
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      ...overrides,
    };
  }
```

- [ ] **Step 6: Bump the save schema version**

The `Character` shape changed, so an old save from before this feature would deserialize with `ownedItemIds`/`equippedItemIds` missing. This project's stated policy is "no migration in MVP — start fresh on mismatch" (see the `deserializeSaveState` comment) — bump the version so that policy actually kicks in for old saves.

Replace the full contents of `src/store/plugins/saveState.ts`:

```ts
// Persistence schema and localStorage read/write helpers. Pure serialization
// concerns only — no game logic lives here.

import type { Boss, Character, Habit } from '../../game-engine';

export const CURRENT_SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'habitica-streak:save:v2';

export interface SaveStateV2 {
  schemaVersion: 2;
  character: Character;
  boss: Boss;
  habits: Habit[];
}

export function serializeSaveState(state: Omit<SaveStateV2, 'schemaVersion'>): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, ...state });
}

export function deserializeSaveState(raw: string): SaveStateV2 | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== CURRENT_SCHEMA_VERSION) return null; // no migration in MVP — start fresh on mismatch
    return parsed as SaveStateV2;
  } catch {
    return null;
  }
}

export function loadSaveState(): SaveStateV2 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeSaveState(raw) : null;
}

export function writeSaveState(state: Omit<SaveStateV2, 'schemaVersion'>): void {
  localStorage.setItem(STORAGE_KEY, serializeSaveState(state));
}
```

(Every occurrence of `SaveStateV1`/`v1`/`= 1` from the original file is replaced: the exported type name, the storage key suffix, the schema version number, and all five function signatures that reference the type.)

- [ ] **Step 7: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS — 100+ tests (the new items.spec.ts from Task 2 should now also pass cleanly if it didn't already).

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/game-engine/types.ts src/game-engine/character.ts src/game-engine/character.spec.ts src/game-engine/combat.spec.ts src/game-engine/leveling.spec.ts src/store/plugins/saveState.ts
git commit -m "Add ownedItemIds/equippedItemIds to Character; bump save schema to v2"
```

---

### Task 4: `effectiveStat` + exp-gain bonus in `leveling.ts`

**Files:**
- Modify: `src/game-engine/leveling.ts`
- Modify: `src/game-engine/leveling.spec.ts`
- Modify: `src/game-engine/index.ts`

**Interfaces:**
- Consumes: `itemBonusPercent` from `./items` (Task 2); `Character` with item fields (Task 3).
- Produces: `effectiveStat(character, stat): number` where `stat` is `'physicalDamage' | 'magicDamage' | 'healing' | 'health'`. Task 5 (`combat.ts`) and Task 9/10 (UI components) all call this instead of raw `statAtLevel`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game-engine/leveling.spec.ts` (new imports + two new `describe` blocks at the end of the file):

Change the top import line:
```ts
import { addExpAndResolveLevelUps, effectiveStat, expToNextLevel, statAtLevel } from './leveling';
```

Add at the end of the file:
```ts
describe('effectiveStat', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      ...overrides,
    };
  }

  it('equals statAtLevel with no equipped items', () => {
    const character = makeCharacter();
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(
      statAtLevel(character.starterStats.physicalDamage, character.level),
      10,
    );
  });

  it('scales up by the equipped item bonus percent', () => {
    const character = makeCharacter({ ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    const base = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(base * 1.03, 10);
  });

  it('sums bonuses from multiple equipped items on the same stat', () => {
    const character = makeCharacter({
      ownedItemIds: ['rusty-blade', 'steel-sword'],
      equippedItemIds: ['rusty-blade', 'steel-sword'],
    });
    const base = statAtLevel(character.starterStats.physicalDamage, character.level);
    expect(effectiveStat(character, 'physicalDamage')).toBeCloseTo(base * 1.09, 10);
  });
});

describe('addExpAndResolveLevelUps with item bonuses', () => {
  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      level: 1,
      exp: 0,
      starterStats: { physicalDamage: 10, magicDamage: 10, healing: 6, health: 50 },
      currentHealth: 50,
      ownedItemIds: [],
      equippedItemIds: [],
      ...overrides,
    };
  }

  it('scales exp gained by the equipped expGain bonus before applying it', () => {
    const character = makeCharacter({ ownedItemIds: ['lucky-coin'], equippedItemIds: ['lucky-coin'] });
    const result = addExpAndResolveLevelUps(character, 10);
    expect(result.character.exp).toBeCloseTo(10 * 1.03, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- leveling.spec.ts`
Expected: FAIL — `effectiveStat` is not exported from `./leveling`; the exp-bonus test fails because `addExpAndResolveLevelUps` doesn't yet apply any bonus.

- [ ] **Step 3: Implement**

Replace the full contents of `src/game-engine/leveling.ts`:

```ts
import { TUNING } from './constants/tuning';
import { itemBonusPercent } from './items';
import type { Character } from './types';

export function expToNextLevel(level: number): number {
  if (level < 5) return 25 * level;
  if (level === 5) return 150;
  return Math.round((level ** 2 * 0.25 + 10 * level + 139.75) / 10) * 10;
}

export function addExpAndResolveLevelUps(
  character: Character,
  expGained: number,
): { character: Character; levelsGained: number } {
  let { level, exp } = character;
  exp += expGained * (1 + itemBonusPercent(character, 'expGain') / 100);
  let levelsGained = 0;
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level += 1;
    levelsGained += 1;
  }
  return { character: { ...character, level, exp }, levelsGained };
}

export function statAtLevel(starterStatValue: number, level: number): number {
  return starterStatValue * Math.pow(1 + TUNING.LEVEL_STAT_GROWTH_RATE, level - 1);
}

/** statAtLevel(...) scaled by the character's equipped-item bonus for `stat`. */
export function effectiveStat(
  character: Character,
  stat: 'physicalDamage' | 'magicDamage' | 'healing' | 'health',
): number {
  const base = statAtLevel(character.starterStats[stat], character.level);
  return base * (1 + itemBonusPercent(character, stat) / 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- leveling.spec.ts`
Expected: PASS.

- [ ] **Step 5: Export from the barrel**

In `src/game-engine/index.ts`, change:
```ts
export { addExpAndResolveLevelUps, expToNextLevel, statAtLevel } from './leveling';
```
to:
```ts
export { addExpAndResolveLevelUps, effectiveStat, expToNextLevel, statAtLevel } from './leveling';
```

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/game-engine/leveling.ts src/game-engine/leveling.spec.ts src/game-engine/index.ts
git commit -m "Add effectiveStat() and apply expGain item bonus in addExpAndResolveLevelUps"
```

---

### Task 5: `combat.ts` integration — `effectiveStat` + item drops on boss defeat

**Files:**
- Modify: `src/game-engine/combat.ts`
- Modify: `src/game-engine/combat.spec.ts`
- Modify: `src/game-engine/index.ts`

**Interfaces:**
- Consumes: `effectiveStat` (Task 4); `rollItemDrops`, `ItemDef` (Task 2).
- Produces: `resolveBossDefeatIfDead(...)` now returns `{ character, boss, defeated, levelsGained, itemsDropped: ItemDef[] }` (new field). `completeHabit` behavior unchanged from the caller's perspective (same `CombatResult` shape), but internally uses `effectiveStat` — item bonuses now affect real damage/healing. Task 6 (`useCombatActions.ts`) relies on the new `itemsDropped` field.

- [ ] **Step 1: Write the failing tests**

In `src/game-engine/combat.spec.ts`, update the top imports:
```ts
import { describe, expect, it } from 'vitest';
import { applyResist, bossExpReward } from './boss';
import { MILESTONE_EXP } from './constants/milestones';
import { ITEM_CATALOG } from './items';
import { addExpAndResolveLevelUps, effectiveStat, statAtLevel } from './leveling';
import { createRng } from './rng';
import { streakMultiplier } from './streaks';
import {
  completeHabit,
  missHabit,
  resolveBossDefeatIfDead,
  resolvePlayerDeathIfDead,
} from './combat';
import type { Boss, Character, Habit } from './types';
```

Add a new test inside `describe('completeHabit', ...)` (after the existing "splits damage proportionally..." test):
```ts
  it('deals more damage when an item bonus is equipped for that damage type', () => {
    const character = makeCharacter({ ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] });
    const habit = makeHabit({ damageType: 'physical' });
    const boss = makeBoss({ armor: 0, health: 1000 });

    const result = completeHabit(character, habit, [habit], boss);

    const boosted = effectiveStat(character, 'physicalDamage');
    expect(boosted).toBeCloseTo(statAtLevel(character.starterStats.physicalDamage, character.level) * 1.03, 10);
    expect(result.damageDealt).toBeCloseTo(boosted * streakMultiplier(1), 10);
  });
```

Update the no-op test in `describe('resolveBossDefeatIfDead', ...)` to also assert `itemsDropped`:
```ts
  it('is a no-op when boss.health > 0', () => {
    const character = makeCharacter();
    const boss = makeBoss({ health: 1 });
    const rng = createRng(1);

    const result = resolveBossDefeatIfDead(character, boss, rng);

    expect(result.defeated).toBe(false);
    expect(result.levelsGained).toBe(0);
    expect(result.character).toBe(character);
    expect(result.boss).toBe(boss);
    expect(result.itemsDropped).toEqual([]);
  });
```

Replace the "grants the correct EXP and spawns the next boss" test with:
```ts
  it('grants the correct EXP, drops an item, and spawns the next boss when boss.health <= 0', () => {
    const character = makeCharacter();
    const boss = makeBoss({ index: 3, health: 0 });
    const rng = createRng(1);

    const result = resolveBossDefeatIfDead(character, boss, rng);

    const leveled = addExpAndResolveLevelUps(character, bossExpReward(3));
    expect(result.defeated).toBe(true);
    expect(result.character.level).toBe(leveled.character.level);
    expect(result.character.exp).toBeCloseTo(leveled.character.exp, 10);
    expect(result.levelsGained).toBe(leveled.levelsGained);
    expect(result.boss.index).toBe(4);
    expect(result.itemsDropped).toHaveLength(1); // boss index 3 -> drop-count curve gives 1
    expect(result.character.ownedItemIds).toEqual(result.itemsDropped.map((item) => item.id));
  });

  it('returns no items dropped once the character already owns the full catalog', () => {
    const character = makeCharacter({ ownedItemIds: ITEM_CATALOG.map((item) => item.id) });
    const boss = makeBoss({ index: 5, health: 0 });

    const result = resolveBossDefeatIfDead(character, boss, createRng(1));

    expect(result.itemsDropped).toEqual([]);
    expect(result.character.ownedItemIds).toHaveLength(ITEM_CATALOG.length);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- combat.spec.ts`
Expected: FAIL — `result.itemsDropped` is `undefined`.

- [ ] **Step 3: Implement**

In `src/game-engine/combat.ts`, update the imports at the top:
```ts
import { applyResist, bossExpReward, generateBoss } from './boss';
import { createCharacter } from './character';
import { DIFFICULTY_WEIGHT } from './constants/difficulty';
import { TUNING } from './constants/tuning';
import { computeDamageSplit, rerollDamageType } from './habits';
import { addExpAndResolveLevelUps, effectiveStat } from './leveling';
import { rollItemDrops } from './items';
import type { ItemDef } from './items';
import type { Rng } from './rng';
import { completeHabitStreak, resetHabitStreak, streakMultiplier } from './streaks';
import type { Boss, Character, DamageType, Habit } from './types';
```
(`statAtLevel` is no longer imported here — both its call sites are replaced below.)

In `completeHabit`, replace:
```ts
  const statValue = statAtLevel(
    character.starterStats[DAMAGE_TYPE_STARTER_STAT[habit.damageType]],
    character.level,
  );
```
with:
```ts
  const statValue = effectiveStat(character, DAMAGE_TYPE_STARTER_STAT[habit.damageType]);
```

Further down in the same function, replace:
```ts
    const healed = Math.min(
      character.currentHealth + amount,
      statAtLevel(character.starterStats.health, character.level),
    );
```
with:
```ts
    const healed = Math.min(character.currentHealth + amount, effectiveStat(character, 'health'));
```

Replace `resolveBossDefeatIfDead` entirely:
```ts
/**
 * No-op unless the boss's health has reached 0. When it has, grants the
 * boss's EXP reward (resolving any resulting level-ups), rolls this
 * character's item drop for this kill, and spawns the next boss.
 */
export function resolveBossDefeatIfDead(
  character: Character,
  boss: Boss,
  rng: Rng,
): { character: Character; boss: Boss; defeated: boolean; levelsGained: number; itemsDropped: ItemDef[] } {
  if (boss.health > 0) return { character, boss, defeated: false, levelsGained: 0, itemsDropped: [] };
  const { character: leveled, levelsGained } = addExpAndResolveLevelUps(character, bossExpReward(boss.index));
  const itemsDropped = rollItemDrops(leveled, boss.index, rng);
  const withItems: Character = {
    ...leveled,
    ownedItemIds: [...leveled.ownedItemIds, ...itemsDropped.map((item) => item.id)],
  };
  return { character: withItems, boss: generateBoss(boss.index + 1, rng), defeated: true, levelsGained, itemsDropped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- combat.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game-engine/combat.ts src/game-engine/combat.spec.ts
git commit -m "Wire item bonuses into combat damage/healing and drop items on boss defeat"
```

---

### Task 6: `characterStore` equip/unequip actions

**Files:**
- Modify: `src/store/characterStore.ts`
- Create: `src/store/characterStore.spec.ts`

**Interfaces:**
- Consumes: `Character.ownedItemIds`/`equippedItemIds` (Task 3).
- Produces: `characterStore.equipItem(itemId: string): void`, `characterStore.unequipItem(itemId: string): void`. Task 9 (`InventoryModal.vue`) calls both.

- [ ] **Step 1: Write the failing tests**

Create `src/store/characterStore.spec.ts`:

```ts
// @vitest-environment jsdom
//
// Matches the jsdom convention used by other Pinia-store-touching specs in
// this project (useDailyRollover.spec.ts, useCombatActions.spec.ts) even
// though this particular store doesn't touch localStorage directly.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from './characterStore';

describe('characterStore equip/unequip', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('equips an owned item', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: [] };

    store.equipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual(['rusty-blade']);
  });

  it('does nothing when equipping an item that is not owned', () => {
    const store = useCharacterStore();
    const before = store.character;

    store.equipItem('not-owned');

    expect(store.character).toEqual(before);
  });

  it('does nothing when equipping an item that is already equipped', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] };

    store.equipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual(['rusty-blade']);
  });

  it('refuses to equip a 5th item when 4 slots are already full', () => {
    const store = useCharacterStore();
    const owned = ['rusty-blade', 'steel-sword', 'apprentice-wand', 'arcane-staff', 'novices-charm'];
    store.character = { ...store.character, ownedItemIds: owned, equippedItemIds: owned.slice(0, 4) };

    store.equipItem('novices-charm');

    expect(store.character.equippedItemIds).toEqual(owned.slice(0, 4));
    expect(store.character.equippedItemIds).toHaveLength(4);
  });

  it('unequips a currently equipped item', () => {
    const store = useCharacterStore();
    store.character = { ...store.character, ownedItemIds: ['rusty-blade'], equippedItemIds: ['rusty-blade'] };

    store.unequipItem('rusty-blade');

    expect(store.character.equippedItemIds).toEqual([]);
  });

  it('does nothing when unequipping an item that is not currently equipped', () => {
    const store = useCharacterStore();
    const before = store.character;

    store.unequipItem('rusty-blade');

    expect(store.character).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- characterStore.spec.ts`
Expected: FAIL — `store.equipItem` is not a function.

- [ ] **Step 3: Implement the actions**

In `src/store/characterStore.ts`, add two actions to the `actions` object (after `setCharacter`, before `addExpAndResolveLevelUps`):

```ts
    /** Equips an owned item into an empty slot. No-op if not owned, already equipped, or all 4 slots are full. */
    equipItem(itemId: string) {
      const { ownedItemIds, equippedItemIds } = this.character;
      if (!ownedItemIds.includes(itemId)) return;
      if (equippedItemIds.includes(itemId)) return;
      if (equippedItemIds.length >= 4) return;
      this.character = { ...this.character, equippedItemIds: [...equippedItemIds, itemId] };
    },

    /** Unequips an item. No-op if it isn't currently equipped. */
    unequipItem(itemId: string) {
      const { equippedItemIds } = this.character;
      if (!equippedItemIds.includes(itemId)) return;
      this.character = { ...this.character, equippedItemIds: equippedItemIds.filter((id) => id !== itemId) };
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- characterStore.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/characterStore.ts src/store/characterStore.spec.ts
git commit -m "Add equipItem/unequipItem actions to characterStore"
```

---

### Task 7: `useCombatActions.checkOffHabit` returns dropped items

**Files:**
- Modify: `src/composables/useCombatActions.ts`
- Modify: `src/composables/useCombatActions.spec.ts`

**Interfaces:**
- Consumes: `resolveBossDefeatIfDead(...).itemsDropped` (Task 5); `ItemDef` type from `../game-engine`.
- Produces: `checkOffHabit(habitId: string): ItemDef[]` — was `void`. Returns `[]` when no habit found, already completed this period, or a defeat happened but the drop pool was exhausted. Task 11 (`HabitListItem.vue`) reads this to trigger the loot toast.

- [ ] **Step 1: Write the failing test**

Add to `src/composables/useCombatActions.spec.ts` (new `it` inside the existing `describe` block):

```ts
  it('checkOffHabit returns the items dropped when completing a habit defeats the boss', () => {
    const habitStore = useHabitStore();
    const bossStore = useBossStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Slay the boss', 'daily', 'hard', createRng());
    habitStore.updateHabit({ ...habit, damageType: 'physical' }); // deterministic damage type
    bossStore.setBoss({ ...bossStore.boss, health: 0.0001, armor: 0 }); // one hit from defeat

    const itemsDropped = checkOffHabit(habit.id);

    expect(itemsDropped.length).toBeGreaterThan(0);
  });

  it('checkOffHabit returns [] when the habit completion does not defeat the boss', () => {
    const habitStore = useHabitStore();
    const { checkOffHabit } = useCombatActions();

    const habit = habitStore.addHabit('Meditate', 'daily', 'easy', createRng());

    const itemsDropped = checkOffHabit(habit.id);

    expect(itemsDropped).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- useCombatActions.spec.ts`
Expected: FAIL — `checkOffHabit(...)` returns `undefined`, `.length` throws / `toEqual([])` fails.

- [ ] **Step 3: Implement**

In `src/composables/useCombatActions.ts`, update the type import line:
```ts
import type { Difficulty, Habit, ItemDef, Period } from '../game-engine';
```

Change `checkOffHabit`'s signature and early returns:
```ts
  function checkOffHabit(habitId: string): ItemDef[] {
    const habit = habitStore.habits.find((h) => h.id === habitId);
    if (!habit) return [];

    const currentPeriodKey = periodKeyFor(habit.period, debugClockStore.now());
    if (habit.lastCompletedPeriodKey === currentPeriodKey) return [];
```

And its final lines — replace:
```ts
    const defeatResult = resolveBossDefeatIfDead(characterStore.character, bossStore.boss, rng);
    if (defeatResult.defeated) {
      characterStore.setCharacter(defeatResult.character);
      bossStore.setBoss(defeatResult.boss);
    }
  }
```
with:
```ts
    const defeatResult = resolveBossDefeatIfDead(characterStore.character, bossStore.boss, rng);
    if (defeatResult.defeated) {
      characterStore.setCharacter(defeatResult.character);
      bossStore.setBoss(defeatResult.boss);
    }

    return defeatResult.itemsDropped;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- useCombatActions.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useCombatActions.ts src/composables/useCombatActions.spec.ts
git commit -m "checkOffHabit returns items dropped on a boss-defeating completion"
```

---

### Task 8: Item icon assets + credits

**Files:**
- Create: `public/sprites/items/*.png` (15 files)
- Modify: `CREDITS.md`

**Interfaces:**
- Consumes: `ITEM_CATALOG`'s `icon` field (Task 2) — each entry's icon path must resolve to a real file under `public/sprites/` for the UI tasks (9-10) to render correctly.
- Produces: 15 PNG files at the exact paths `ITEM_CATALOG` expects.

- [ ] **Step 1: Create the directory and download the 15 icons**

```bash
mkdir -p public/sprites/items
cd public/sprites/items

curl -sL -o rusty-blade.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_warrior_1.png"
curl -sL -o steel-sword.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_warrior_3.png"
curl -sL -o warlords-greatsword.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_warrior_5.png"
curl -sL -o apprentice-wand.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_wizard_1.png"
curl -sL -o arcane-staff.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_wizard_3.png"
curl -sL -o archmages-rod.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_wizard_5.png"
curl -sL -o novices-charm.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_healer_1.png"
curl -sL -o blessed-censer.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_healer_3.png"
curl -sL -o sacred-chalice.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/weapon/shop/shop_weapon_healer_5.png"
curl -sL -o padded-vest.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/armor/shop/shop_armor_warrior_1.png"
curl -sL -o chainmail-hauberk.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/armor/shop/shop_armor_warrior_3.png"
curl -sL -o plate-armor.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/gear/armor/shop/shop_armor_warrior_5.png"
curl -sL -o lucky-coin.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/misc/Pet_Currency_Gem.png"
curl -sL -o shining-star.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/misc/seafoam_star.png"
curl -sL -o rebirth-orb.png "https://raw.githubusercontent.com/HabitRPG/habitica-images/master/misc/rebirth_orb.png"

cd -
```

- [ ] **Step 2: Verify all 15 files exist and are non-empty**

```bash
ls -la public/sprites/items/ | grep -c '\.png$'
```
Expected: `15`

```bash
find public/sprites/items -name '*.png' -size -100c
```
Expected: no output (a hit here means a download silently returned a 0-byte/error file instead of a real PNG — re-run that one `curl` command).

- [ ] **Step 3: Update `CREDITS.md`**

Add a new section at the end of `CREDITS.md` (after the existing "Boss sprites" table):

```markdown

## Item icons

`public/sprites/items/*.png` are sourced from [HabitRPG/habitica-images](https://github.com/HabitRPG/habitica-images) (gear shop-preview icons and misc currency/trinket icons), licensed [CC-BY-NC-SA 3.0](http://creativecommons.org/licenses/by-nc-sa/3.0/). Used here non-commercially, in a share-alike personal project, with attribution.

| File | Source |
|---|---|
| `items/rusty-blade.png` | `gear/weapon/shop/shop_weapon_warrior_1.png` |
| `items/steel-sword.png` | `gear/weapon/shop/shop_weapon_warrior_3.png` |
| `items/warlords-greatsword.png` | `gear/weapon/shop/shop_weapon_warrior_5.png` |
| `items/apprentice-wand.png` | `gear/weapon/shop/shop_weapon_wizard_1.png` |
| `items/arcane-staff.png` | `gear/weapon/shop/shop_weapon_wizard_3.png` |
| `items/archmages-rod.png` | `gear/weapon/shop/shop_weapon_wizard_5.png` |
| `items/novices-charm.png` | `gear/weapon/shop/shop_weapon_healer_1.png` |
| `items/blessed-censer.png` | `gear/weapon/shop/shop_weapon_healer_3.png` |
| `items/sacred-chalice.png` | `gear/weapon/shop/shop_weapon_healer_5.png` |
| `items/padded-vest.png` | `gear/armor/shop/shop_armor_warrior_1.png` |
| `items/chainmail-hauberk.png` | `gear/armor/shop/shop_armor_warrior_3.png` |
| `items/plate-armor.png` | `gear/armor/shop/shop_armor_warrior_5.png` |
| `items/lucky-coin.png` | `misc/Pet_Currency_Gem.png` |
| `items/shining-star.png` | `misc/seafoam_star.png` |
| `items/rebirth-orb.png` | `misc/rebirth_orb.png` |
```

- [ ] **Step 4: Commit**

```bash
git add public/sprites/items/ CREDITS.md
git commit -m "Add item icon assets from HabitRPG/habitica-images"
```

---

### Task 9: `InventoryModal.vue` + wire into `CharacterPanel.vue`

**Files:**
- Create: `src/components/character/InventoryModal.vue`
- Modify: `src/components/character/CharacterPanel.vue`

**Interfaces:**
- Consumes: `ITEM_CATALOG`, `effectiveStat` from `../../game-engine`; `characterStore.equipItem`/`unequipItem` (Task 6); icon files at `public/sprites/items/*.png` (Task 8).
- Produces: a new `InventoryModal` component, and `CharacterPanel.vue` gains an "Inventory" button. No new exports consumed by later tasks.

No test — this is a `.vue` component change, outside this project's existing coverage boundary (see Global Constraints). Verify manually per Step 4.

- [ ] **Step 1: Create `InventoryModal.vue`**

Create `src/components/character/InventoryModal.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { ITEM_CATALOG } from '../../game-engine';
import type { Character } from '../../game-engine';
import { useCharacterStore } from '../../store/characterStore';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; character: Character }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const characterStore = useCharacterStore();

const ownedItems = computed(() => ITEM_CATALOG.filter((item) => props.character.ownedItemIds.includes(item.id)));
const equippedCount = computed(() => props.character.equippedItemIds.length);

function isEquipped(itemId: string): boolean {
  return props.character.equippedItemIds.includes(itemId);
}

function toggleEquip(itemId: string) {
  if (isEquipped(itemId)) {
    characterStore.unequipItem(itemId);
  } else {
    characterStore.equipItem(itemId);
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Inventory"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <p class="equip-count">{{ equippedCount }} / 4 equipped</p>

    <p v-if="ownedItems.length === 0" class="empty">No items yet — defeat a boss to find your first one.</p>

    <ul v-else class="item-list">
      <li v-for="item in ownedItems" :key="item.id" class="item-row">
        <img class="item-icon" :src="`/sprites/${item.icon}.png`" :alt="item.name" />
        <div class="item-info">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-bonus">+{{ item.bonusPercent }}% {{ item.stat }}</span>
        </div>
        <button
          type="button"
          class="equip-toggle"
          :disabled="!isEquipped(item.id) && equippedCount >= 4"
          @click="toggleEquip(item.id)"
        >
          {{ isEquipped(item.id) ? 'Unequip' : 'Equip' }}
        </button>
      </li>
    </ul>
  </Modal>
</template>

<style scoped>
.equip-count {
  margin: 0 0 0.75rem;
  font-weight: 600;
}

.empty {
  opacity: 0.7;
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.item-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 600;
}

.item-bonus {
  font-size: 0.85em;
  opacity: 0.7;
}

.equip-toggle {
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 2: Wire it into `CharacterPanel.vue`**

Replace the full contents of `src/components/character/CharacterPanel.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { effectiveStat, expToNextLevel } from '../../game-engine';
import { useDamagePopup } from '../../composables/useDamagePopup';
import { useCharacterStore } from '../../store/characterStore';
import CharacterStatsModal from './CharacterStatsModal.vue';
import InventoryModal from './InventoryModal.vue';
import ExpBar from '../ui/ExpBar.vue';
import HealthBar from '../ui/HealthBar.vue';
import Sprite from '../ui/Sprite.vue';

const characterStore = useCharacterStore();

const character = computed(() => characterStore.character);
const maxHealth = computed(() => effectiveStat(character.value, 'health'));
const expNeeded = computed(() => expToNextLevel(character.value.level));

const showStatsModal = ref(false);
const showInventoryModal = ref(false);

const { popups, isHit } = useDamagePopup(() => characterStore.character.currentHealth);
</script>

<template>
  <section class="panel character-panel" @click="showStatsModal = true">
    <div class="panel-header">
      <div class="sprite-wrapper" :class="{ hit: isHit }">
        <Sprite image-name="player-placeholder" alt="Player" />
        <span v-for="popup in popups" :key="popup.id" class="damage-popup">-{{ popup.amount }}</span>
      </div>
      <h2>Character — Level {{ character.level }}</h2>
      <button type="button" class="inventory-button" @click.stop="showInventoryModal = true">Inventory</button>
    </div>
    <HealthBar :current="character.currentHealth" :max="maxHealth" variant="player" />
    <ExpBar :current="character.exp" :max="expNeeded" />
  </section>

  <CharacterStatsModal v-model="showStatsModal" :character="character" />
  <InventoryModal v-model="showInventoryModal" :character="character" />
</template>

<style scoped>
.character-panel {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel-header h2 {
  margin: 0;
}

.inventory-button {
  margin-left: auto;
  flex-shrink: 0;
}

.sprite-wrapper {
  position: relative;
  display: inline-block;
}

.sprite-wrapper.hit :deep(.sprite) {
  animation: sprite-shake 0.3s ease;
}

.damage-popup {
  position: absolute;
  top: 0;
  left: 50%;
  color: #e5484d;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: damage-float-fade 0.9s ease-out forwards;
}

@keyframes sprite-shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(3px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-4px);
  }
  40%,
  60% {
    transform: translateX(4px);
  }
}

@keyframes damage-float-fade {
  0% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
}
</style>
```

(This preserves the `useDamagePopup`/shake/float-fade styling added in the earlier combat-animations work — only the `maxHealth` computation and the new button/modal are new.)

- [ ] **Step 3: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the app. Click "Inventory" on the character panel — the modal should open showing "0 / 4 equipped" and the empty-state message (a fresh character owns no items yet). Close it; confirm clicking elsewhere on the character panel still opens the stats modal as before (the button's `@click.stop` shouldn't have broken that).

- [ ] **Step 5: Run the full suite (regression check) and commit**

Run: `npm run test:unit -- --run`
Expected: PASS (no test touches these `.vue` files, but this confirms nothing else broke).

```bash
git add src/components/character/InventoryModal.vue src/components/character/CharacterPanel.vue
git commit -m "Add InventoryModal with equip/unequip UI"
```

---

### Task 10: `effectiveStat` + equipped-items list in stat modals

**Files:**
- Modify: `src/components/character/CharacterStatsModal.vue`
- Modify: `src/components/habits/HabitStatsModal.vue`

**Interfaces:**
- Consumes: `effectiveStat`, `ITEM_CATALOG` from `../../game-engine`.
- Produces: nothing new consumed by later tasks — this is the last of the `statAtLevel` → `effectiveStat` call-site swaps described in the spec.

No test — `.vue` component change, outside this project's coverage boundary. Verify manually per Step 3.

- [ ] **Step 1: Update `CharacterStatsModal.vue`**

Replace the full contents of `src/components/character/CharacterStatsModal.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { effectiveStat, expToNextLevel, ITEM_CATALOG } from '../../game-engine';
import type { Character } from '../../game-engine';
import Modal from '../ui/Modal.vue';

const props = defineProps<{ modelValue: boolean; character: Character }>();
defineEmits<{ 'update:modelValue': [value: boolean] }>();

const level = computed(() => props.character.level);
const physicalDamage = computed(() => effectiveStat(props.character, 'physicalDamage'));
const magicDamage = computed(() => effectiveStat(props.character, 'magicDamage'));
const healing = computed(() => effectiveStat(props.character, 'healing'));
const maxHealth = computed(() => effectiveStat(props.character, 'health'));
const expNeeded = computed(() => expToNextLevel(level.value));
const equippedItems = computed(() => ITEM_CATALOG.filter((item) => props.character.equippedItemIds.includes(item.id)));
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Character stats"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <dl class="stat-list">
      <dt>Level</dt>
      <dd>{{ level }}</dd>

      <dt>EXP</dt>
      <dd>{{ Math.round(character.exp) }} / {{ Math.round(expNeeded) }}</dd>

      <dt>Health</dt>
      <dd>{{ Math.round(character.currentHealth) }} / {{ Math.round(maxHealth) }}</dd>

      <dt>Physical damage</dt>
      <dd>{{ physicalDamage.toFixed(1) }}</dd>

      <dt>Magic damage</dt>
      <dd>{{ magicDamage.toFixed(1) }}</dd>

      <dt>Healing</dt>
      <dd>{{ healing.toFixed(1) }}</dd>
    </dl>

    <h4 class="equipped-heading">Equipped items</h4>
    <p v-if="equippedItems.length === 0" class="empty">None equipped.</p>
    <ul v-else class="equipped-list">
      <li v-for="item in equippedItems" :key="item.id">{{ item.name }} (+{{ item.bonusPercent }}% {{ item.stat }})</li>
    </ul>
  </Modal>
</template>

<style scoped>
.stat-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1rem;
  margin: 0;
}

.stat-list dt {
  font-weight: 600;
  color: var(--text-h);
}

.stat-list dd {
  margin: 0;
  text-align: right;
}

.equipped-heading {
  margin: 1rem 0 0.4rem;
}

.empty {
  opacity: 0.7;
  margin: 0;
}

.equipped-list {
  margin: 0;
  padding-left: 1.2rem;
}
</style>
```

- [ ] **Step 2: Update `HabitStatsModal.vue`**

In `src/components/habits/HabitStatsModal.vue`, change the import line:
```ts
import { computeDamageSplit, DAMAGE_TYPE_STARTER_STAT, effectiveStat, streakMultiplier } from '../../game-engine';
```

And inside the `baseDamage` computed, replace:
```ts
  const statValue = statAtLevel(character.starterStats[statField], character.level);
```
with:
```ts
  const statValue = effectiveStat(character, statField);
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`. Open the character stats modal (click the character panel) — should show the same numbers as before (a fresh character has no equipped items, so `effectiveStat` output is identical to the old `statAtLevel` output) plus a new "Equipped items" section reading "None equipped." Open a habit's stats modal — base damage should read the same as before.

To see the bonus actually apply: in the browser console, note the app doesn't expose Pinia stores globally, so the easiest manual check is via `npm run test:unit -- --run` (Step 4) plus the existing `leveling.spec.ts`/`combat.spec.ts` cases from Tasks 4-5, which already assert the numeric change. Full end-to-end "equip an item and watch the modal number change" is naturally covered once Task 9's InventoryModal is in place and an item has actually dropped — no separate manual step needed here.

- [ ] **Step 4: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/character/CharacterStatsModal.vue src/components/habits/HabitStatsModal.vue
git commit -m "Show equipped items in character stats; use effectiveStat everywhere"
```

---

### Task 11: Loot toast on item drop

**Files:**
- Create: `src/composables/useLootToast.ts`
- Create: `src/composables/useLootToast.spec.ts`
- Create: `src/components/ui/LootToast.vue`
- Modify: `src/components/layout/AppShell.vue`
- Modify: `src/components/habits/HabitListItem.vue`

**Interfaces:**
- Consumes: `checkOffHabit(...)`'s `ItemDef[]` return value (Task 7).
- Produces: `useLootToast()` returning `{ toasts: Ref<LootToastEntry[]>, addLoot(itemNames: string[]): void }` — a module-scoped singleton (unlike `useDamagePopup`, every caller shares the same queue, since the component that triggers a drop and the component that renders the toast stack are different).

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useLootToast.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLootToast } from './useLootToast';

describe('useLootToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds one toast per item name', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot(['Steel Sword', 'Lucky Coin']);

    expect(toasts.value.length).toBe(before + 2);
    expect(toasts.value.at(-2)?.message).toBe('Found: Steel Sword!');
    expect(toasts.value.at(-1)?.message).toBe('Found: Lucky Coin!');
  });

  it('auto-removes a toast after its lifetime', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot(['Rusty Blade']);
    expect(toasts.value.length).toBe(before + 1);

    vi.advanceTimersByTime(3000);
    expect(toasts.value.length).toBe(before);
  });

  it('does nothing for an empty list', () => {
    const { toasts, addLoot } = useLootToast();
    const before = toasts.value.length;

    addLoot([]);

    expect(toasts.value.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- useLootToast.spec.ts`
Expected: FAIL — `./useLootToast` does not exist.

- [ ] **Step 3: Implement `useLootToast.ts`**

Create `src/composables/useLootToast.ts`:

```ts
// Small shared (module-scoped) toast queue for boss-kill item drops. Unlike
// useDamagePopup (one independent instance per panel), this state must be a
// single singleton: the component that triggers a drop (HabitListItem) and
// the component that renders the queue (LootToast, mounted once in
// AppShell) need to see the same list.

import { ref } from 'vue';

export interface LootToastEntry {
  id: number;
  message: string;
}

const TOAST_LIFETIME_MS = 3000;

const toasts = ref<LootToastEntry[]>([]);
let nextId = 0;

export function useLootToast() {
  function addLoot(itemNames: string[]) {
    for (const name of itemNames) {
      const id = nextId++;
      toasts.value.push({ id, message: `Found: ${name}!` });
      setTimeout(() => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
      }, TOAST_LIFETIME_MS);
    }
  }

  return { toasts, addLoot };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- useLootToast.spec.ts`
Expected: PASS.

- [ ] **Step 5: Create `LootToast.vue`**

Create `src/components/ui/LootToast.vue`:

```vue
<script setup lang="ts">
import { useLootToast } from '../../composables/useLootToast';

const { toasts } = useLootToast();
</script>

<template>
  <div class="loot-toast-stack">
    <div v-for="toast in toasts" :key="toast.id" class="loot-toast">{{ toast.message }}</div>
  </div>
</template>

<style scoped>
.loot-toast-stack {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  z-index: 1100;
  pointer-events: none;
}

.loot-toast {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  box-shadow: var(--shadow);
  animation: loot-toast-fade 3s ease forwards;
}

@keyframes loot-toast-fade {
  0%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
```

- [ ] **Step 6: Mount it in `AppShell.vue`**

In `src/components/layout/AppShell.vue`, add the import:
```ts
import LootToast from '../ui/LootToast.vue';
```
And add `<LootToast />` as the first child inside `.app-shell` in the template (before `<SkipDayButton />`):
```html
  <div class="app-shell">
    <LootToast />
    <SkipDayButton />
    <div class="top-panels">
      <CharacterPanel />
      <BossPanel />
    </div>
    <HabitList />
  </div>
```

- [ ] **Step 7: Wire the trigger in `HabitListItem.vue`**

In `src/components/habits/HabitListItem.vue`, add the import:
```ts
import { useLootToast } from '../../composables/useLootToast';
```
Add alongside the existing `useCombatActions`/`useDebugClockStore` calls:
```ts
const { checkOffHabit } = useCombatActions();
const { addLoot } = useLootToast();
const debugClockStore = useDebugClockStore();
```
Replace `onCheckOff`:
```ts
function onCheckOff() {
  const itemsDropped = checkOffHabit(props.habit.id);
  if (itemsDropped.length > 0) {
    addLoot(itemsDropped.map((item) => item.name));
  }
}
```

- [ ] **Step 8: Manually verify in the browser**

Run: `npm run dev`. Add a habit, check it off repeatedly (or use the "Skip to next day" debug control plus check-offs) until a boss dies — a "Found: ..." toast should appear top-right and fade out after ~3s.

- [ ] **Step 9: Run the full suite and type-check**

Run: `npm run test:unit -- --run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/composables/useLootToast.ts src/composables/useLootToast.spec.ts src/components/ui/LootToast.vue src/components/layout/AppShell.vue src/components/habits/HabitListItem.vue
git commit -m "Add loot toast notification on item drop"
```

---

### Task 12: Update `PROGRESS.md`

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Rewrite the "Deferred / not yet built" section**

In `PROGRESS.md`, remove the "Items/equipment" and "Combat animations" and "Real sprite art" bullets from "Deferred / not yet built" (all three shipped across this session's work), leaving only the ESLint findings and any genuinely still-deferred item. Add a new section (after "Testing/debug tooling added post-MVP") summarizing what shipped:

```markdown
## Items/equipment (added post-MVP)

A curated 15-item catalog (3 tiers × 5 stat categories: physical/magic/healing/health/exp-gain) drops off boss kills via a step curve (`TUNING.ITEM_DROP_EVERY_N_BOSSES`/`ITEM_DROP_MAX_COUNT`) and is unique per character — once owned, an item leaves that character's drop pool until the next death/reset. 4 interchangeable equip slots (no slot-type restrictions). `effectiveStat()` in `game-engine/leveling.ts` layers the equipped-item bonus on top of the existing level-scaled stat everywhere `statAtLevel` used to be read directly (`combat.ts`, `CharacterPanel.vue`, `CharacterStatsModal.vue`, `HabitStatsModal.vue`); `addExpAndResolveLevelUps` applies the `expGain` bonus internally so no caller can forget it. New `InventoryModal.vue` (equip/unequip UI) and a loot toast (`useLootToast.ts`/`LootToast.vue`) surface drops. See `docs/superpowers/specs/2026-09-16-items-equipment-design.md` for the full design.
```

- [ ] **Step 2: Commit**

```bash
git add PROGRESS.md
git commit -m "Update PROGRESS.md for shipped items/equipment feature"
```

---

## Self-Review Notes

- **Spec coverage:** every confirmed decision in the spec (interchangeable slots, curated 15-item catalog, unique-per-character drops, distinct icons, `effectiveStat`/exp-bonus centralization, drop-count curve, `InventoryModal`, loot toast, equipped-items display, testing boundary) maps to a task above.
- **Type consistency checked:** `ItemDef`/`BoostableStat` (Task 2) → used identically in `leveling.ts` (Task 4), `combat.ts` (Task 5), `useCombatActions.ts` (Task 7), and both `.vue` tasks (9-10). `resolveBossDefeatIfDead`'s new `itemsDropped: ItemDef[]` field (Task 5) is consumed with that exact name in Task 7 and asserted with that exact name in Task 5's own tests. `characterStore.equipItem`/`unequipItem` (Task 6) called with those exact names from `InventoryModal.vue` (Task 9).
- **No placeholders:** every step above contains complete, runnable code — no "add appropriate handling" or "similar to Task N" shortcuts.

