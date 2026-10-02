# Item Overhaul — Design Spec

Status as of 2026-10-02. Follow-up to `docs/superpowers/specs/2026-09-16-items-equipment-design.md`, which shipped the original 18-item catalog, 4 fixed equip slots, and percent-only stat bonuses. This spec adds a second, more powerful tier of items that unlocks progressively by player level, plus two mechanics (flat stat bonuses, armor/magic penetration) and one new player-facing stat category (armor/magicResist as player mitigation) that didn't exist before.

## Context

Playtesting surfaced that the current boss curve is already fairly soft for a consistent player (boss 12 still felt easy at 70-80% daily completion with minimal streak stacking). Rather than retune boss difficulty blind, the decision for this pass is: **ship the item overhaul with no boss-side compensation, and observe how it actually plays before touching `boss.ts`/`tuning.ts` boss constants.** Boss retuning is explicitly deferred — see "Out of scope" below.

The resist formula (`resist/(resist+K)`) is asymptotic and self-limiting — no matter how large a stat gets, reduction never reaches 100%. This means item power creep can't literally break anything (no risk of a boss becoming unkillable or a divide-by-zero); it can only shift how far a given playstyle gets, which is exactly what we want to observe empirically.

## Confirmed product decisions

- **Original 18 items are untouched** — same stats, same rarities, always droppable, no level gate.
- **19 new items**, organized into 5 themes (physical, magic, defense, support, balanced — see catalog below), introduced as a second tier.
- **New items unlock progressively by player level**, not rarity: a random ~third unlocks at level 10, another ~third at 15, the rest at 20. The *assignment* of which items land in which tier is randomized once per run (same pattern as `rollRunDifficultyModifier`/`DAMAGE_SPLIT_RATIOS` — rolled at character creation, fixed for that run, re-rolled on death).
- **Equip slots: 4 → 6 at level 10**, coinciding with the first new-item unlock wave.
- **Flat stat bonuses are new.** Today's `ItemDef` only supports percent bonuses. New items mix flat amounts ("+200 physical damage") with percents, so `ItemDef` is restructured to hold an arbitrary-length bonus list instead of today's fixed primary/extra pair.
- **Flat bonuses apply before any percent multiplier** (item percent, streak, Special/Ult, Overdrive) — they're added into the stat's level-scaled base, so every multiplier that follows also scales the flat amount. This keeps a flat item relevant at high streak/multiplier counts instead of being diluted into irrelevance.
- **Armor Pen / Magic Pen are new.** They reduce the *boss's* effective armor/magicResist before the boss's own resist formula runs: `effectiveBossResist = bossResist * (1 - totalPenPct/100)`. Total pen from items is capped at 90% (mirrors how `CRIT_CHANCE_CAP` keeps crit under 100%) — a boss retains at least 10% of its true resist no matter how much pen is stacked.
- **Player armor/magicResist are new.** The player currently has zero mitigation against boss-miss damage. New defense items grant flat `armor`/`magicResist`, mitigating incoming boss attacks via **the exact same `applyResist`/`damageReductionPct` functions and the same `RESIST_K` constant bosses already use** — no new formula, no new constant. (Confirmed explicitly: a maxed defense build tops out around 25-40% mitigation under this K, which is intentionally modest — defense items are supporting, not a primary win condition.)

## Data model changes

`src/game-engine/types.ts` — `Character` gains one field:

```ts
export interface Character {
  // ...existing fields unchanged...
  // Rolled once at createCharacter (and re-rolled by resolvePlayerDeathIfDead,
  // since it calls createCharacter for the fresh run). Maps each level-gated
  // item's id to the player level at which it starts being droppable.
  newItemUnlockTiers: Record<string, 10 | 15 | 20>;
}
```

`src/game-engine/character.ts` — `createCharacter` additionally calls a new `items.ts` export to populate `newItemUnlockTiers`:

```ts
newItemUnlockTiers: assignNewItemUnlockTiers(createRng-derived rng passed in),
```

## `src/game-engine/items.ts` changes

### Restructured `ItemDef`

```ts
export type BoostableStat =
  | 'physicalDamage' | 'magicDamage' | 'healing' | 'health'
  | 'expGain' | 'critChance' | 'lifesteal'
  | 'armorPen' | 'magicPen'   // new — percent only, reduces boss resist
  | 'armor' | 'magicResist';  // new — flat only, player mitigation stat

export interface ItemBonus {
  stat: BoostableStat;
  percent?: number;
  flat?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: 'equipment' | 'consumable';
  rarity: ItemRarity;
  bonuses: ItemBonus[]; // replaces stat/bonusPercent/extraStat/extraBonusPercent
  levelGated?: true; // present only on the 19 new items; absent/falsy on the original 18
}
```

The 18 existing catalog entries are rewritten into this shape with identical values (e.g. Rusty Blade becomes `bonuses: [{ stat: 'physicalDamage', percent: 3 }]`) — no behavior change for them.

### New catalog items (19), by theme

Icon paths follow the existing `items/<id>` convention; actual art is out of scope here (matches the rest of the game's current placeholder-art state).

**Physical**
| id / name | rarity | bonuses |
|---|---|---|
| `berserkers-war-axe` — Berserker's War Axe | rare | +200 flat physicalDamage, +5% lifesteal |
| `serrated-ripper` — Serrated Ripper | rare | +150 flat physicalDamage, +20% armorPen |
| `bloodthorn-blade` — Bloodthorn Blade | epic | +100 flat physicalDamage, +10% physicalDamage, +2% lifesteal, +10% armorPen |
| `piercing-fang-gauntlets` — Piercing Fang Gauntlets | epic | +30% armorPen, +10% physicalDamage, +200 flat health |

**Magic**
| id / name | rarity | bonuses |
|---|---|---|
| `runeforged-spellblade` — Runeforged Spellblade | epic | +400 flat magicDamage, +100 flat magicResist |
| `chaos-conduit` — Chaos Conduit | rare | +30% magicDamage, +20% magicPen |
| `scholars-grimoire` — Scholar's Grimoire | uncommon | +100 flat magicDamage, +5% magicPen, +10% expGain |

**Defense**
| id / name | rarity | bonuses |
|---|---|---|
| `bulwark-plate` — Bulwark Plate | rare | +10% health, +500 flat health |
| `aegis-of-the-unbroken` — Aegis of the Unbroken | epic | +200 flat health, +20% health, +50 flat armor, +50 flat magicResist |
| `juggernaut-carapace` — Juggernaut Carapace | rare | +300 flat armor, +200 flat health |
| `warding-sigil` — Warding Sigil | uncommon | +10% health, +150 flat magicResist |

**Support**
| id / name | rarity | bonuses |
|---|---|---|
| `serene-lotus-charm` — Serene Lotus Charm | uncommon | +12% healing, +12% expGain |
| `font-of-renewal` — Font of Renewal | rare | +200 flat healing, +5% expGain |
| `pilgrims-blessing` — Pilgrim's Blessing | uncommon | +100 flat healing, +5% health, +5% expGain |
| `adventurers-sigil` — Adventurer's Sigil | rare | +10% expGain, +10% health, +2% lifesteal, +100 flat armor |

**Balanced**
| id / name | rarity | bonuses |
|---|---|---|
| `duelists-signet` — Duelist's Signet | rare | +100 flat health, +50 flat physicalDamage, +20% armorPen, +2% lifesteal |
| `warded-longsword` — Warded Longsword | uncommon | +100 flat armor, +50 flat magicDamage |
| `stalwart-sages-ring` — Stalwart Sage's Ring | uncommon | +50 flat armor, +50 flat magicResist, +5% healing, +5% health |
| `titans-lifeblood` — Titan's Lifeblood | epic | +1000 flat health, +5% healing, +5% lifesteal |

All 19 get `levelGated: true`.

### Level-gated unlock assignment

```ts
/**
 * Shuffles the level-gated items and splits them into three groups via
 * Math.ceil(n/3) chunking (7/7/5 for today's 19 items), assigning the
 * first group to unlock at level 10, the second at 15, the third at 20.
 * Called once per run (createCharacter) — rng-driven, so it varies run to run.
 */
export function assignNewItemUnlockTiers(rng: Rng): Record<string, 10 | 15 | 20>;
```

### Updated lookup/bonus functions

```ts
/** Sums bonus.percent across equipped items' bonuses matching `stat`. */
export function itemBonusPercent(character: Character, stat: BoostableStat): number;

/** Sums bonus.flat across equipped items' bonuses matching `stat`. New. */
export function itemFlatBonus(character: Character, stat: BoostableStat): number;

/** 4 below level 10, 6 at level 10+. New — replaces the hardcoded 4 in characterStore.ts. */
export function maxEquipSlots(level: number): number;
```

### `rollItemDrops` change

The droppable pool becomes: every original item, plus every level-gated item whose unlock tier (`character.newItemUnlockTiers[item.id]`) is `<= character.level`. Everything else about the function (unowned filter, rarity-weighted sampling, drop-count curve) is unchanged.

## `src/game-engine/combat.ts` changes

**Flat-before-percent**, in `completeHabit`: the line computing `rawStat` becomes `statAtLevel(...) + itemFlatBonus(character, statField)`. Everything downstream (the per-habit split, then `* itemMultiplier * streakMult * bonusMultiplier * overdriveFactor`) is otherwise unchanged — the flat amount now rides through every multiplier that follows instead of being tacked on after them. Same treatment in `leveling.ts`'s `effectiveStat` for `health`: `(statAtLevel(...) + itemFlatBonus(character,'health')) * itemStatMultiplier(character,'health')`.

**Armor/Magic Pen**, in `completeHabit`'s boss-damage branch: before calling `applyResist`, reduce the boss's resist stat by the character's capped pen percent for the matching damage type:
```ts
const penPct = Math.min(itemBonusPercent(character, habit.damageType === 'physical' ? 'armorPen' : 'magicPen'), TUNING.ARMOR_MAGIC_PEN_CAP_PCT);
const effectiveResistStat = resistStat * (1 - penPct / 100);
const dealt = applyResist(critAmount, effectiveResistStat);
```

**Player mitigation**, in `missHabit`: after computing the raw `damage` (attack × factors, before it's applied to health), mitigate it through the player's armor/magicResist using the existing `applyResist` (same function, same `RESIST_K`, imported from `boss.ts` the same way `completeHabit` already does):
```ts
const playerResistStat = attackType === 'physical' ? itemFlatBonus(character, 'armor') : itemFlatBonus(character, 'magicResist');
const mitigatedDamage = applyResist(damage, playerResistStat);
```
`newHealth`, and the boss's lifesteal-heal calculation (`damage * boss.lifestealPct`), both switch from `damage` to `mitigatedDamage` — boss lifesteal should scale off what actually landed on the player, matching how `completeHabit`'s lifesteal/reflect already key off `dealt` (post-resist) rather than the pre-resist amount.

New tuning constant (`constants/tuning.ts`): `ARMOR_MAGIC_PEN_CAP_PCT: 90`.

## `src/store/characterStore.ts` change

`equipItem`'s slot-cap check changes from the literal `4` to `maxEquipSlots(this.character.level)`.

## UI touch-ups (not detailed here, implementer's discretion within existing patterns)

- `InventoryModal.vue`'s "X/4 equipped" counter becomes "X/N equipped" using `maxEquipSlots`.
- Item bonus display (tooltips, `describeItemBonus`-equivalent) needs to render an arbitrary-length `bonuses` list instead of the old fixed primary/extra pair, and needs a flat-vs-percent-aware formatter (`+200 physicalDamage` vs `+5% lifesteal`).
- Locked-but-not-yet-unlocked items are never shown to the player at all (they're simply absent from the drop pool and never owned) — no "mystery locked item" UI needed.

## Testing

- `game-engine/items.spec.ts`: `itemBonusPercent`/`itemFlatBonus` sum correctly across the new multi-entry `bonuses` arrays; `assignNewItemUnlockTiers` produces a full, non-overlapping partition of all 19 ids across the three tiers, varies with the rng seed; `rollItemDrops` excludes a level-gated item below its assigned tier and includes it at/above; `maxEquipSlots` returns 4 below level 10 and 6 at/above.
- `game-engine/combat.spec.ts`: flat item bonus increases damage/healing and scales with streak multiplier (regression-proof the ordering); armor/magic pen reduces effective boss resist and respects the 90% cap when stacked past it; player armor/magicResist reduces `missHabit` damage via the same resist curve, and boss lifesteal heals off the mitigated (not raw) amount.
- `game-engine/leveling.spec.ts`: `effectiveStat('health')` reflects a flat health item bonus before the percent multiplier.
- `store/characterStore.spec.ts`: `equipItem` respects the level-dependent slot cap (blocks a 5th item below level 10, allows up to 6 at level 10+).

## Deliberately out of scope (this pass)

- **No boss difficulty changes.** `BOSS_GROWTH_RATE`, `BASE_BOSS_POWER`, and the miss-damage curve are untouched. We're shipping items first and observing actual play before deciding whether/how to compensate.
- **No dynamic boss scaling.** `generateBoss` does not read character/item state (per the earlier static-vs-dynamic decision) — confirmed still correct since boss-side changes are deferred entirely.
- No set bonuses, no slot-type restrictions (equip slots remain interchangeable), no sell/discard mechanic.
- No UI mockups — icon/art sourcing and exact tooltip layout are implementer's discretion, consistent with this project's existing placeholder-art state.
