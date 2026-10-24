# Item Rework — Design Spec

Status as of 2026-10-23, draft for review. Third pass on items, after `2026-09-16-items-equipment-design.md` (original catalog) and `2026-10-02-item-overhaul-design.md` (level-gated tier, flat bonuses, armor/pen). Replaces the side-only item pool from `2026-10-21-quests-v2-design.md` with relics.

## Why

A balance review of the 49-item catalog found:

- **Flat and percent bonuses are mixed**, sometimes on the same stat of the same item ("Physical +100, Physical +10%"), and flat damage/health fades with level: +200 physical is +21% at L10 but +3% at L45.
- **The level-gated "second tier" is weaker than the original rares/epics** (Bloodthorn Blade ≈ +18% physical vs. Godslayer's +50%).
- **Rarer items aren't distinct.** Several rares/epics are single-stat items that differ from commons only in the number.
- **Item progression ends around boss 20.** The last unlock wave is L20 and drop rarities even out at boss 20.
- **No true-damage items at all.**
- **Side-quest rewards are ordinary** (2 random original rares/epics pulled from drops, which the player never notices), can be useless for the run, and are all front-loaded.

## Design rules

These apply to every item, now and later. A few deliberate exceptions are called out in the catalog.

1. **Percent for scaling stats.** Physical, magic, true damage, healing and health bonuses are always a percent. Armor and magic resist stay flat ("Armor +300"), at about today's values. Armor pen / magic pen stay percents with today's wording and values.
2. **One main theme per item:** physical, magic, true, tank, or support (healing, EXP).
3. **Magic hits harder but leaves you exposed.** Magic items carry a bigger damage number than physical items of the same rarity, with no survivability; their secondaries are crit, magic pen, or a drawback (and a drawback buys an even bigger number).
4. **Physical hits a bit softer but keeps you standing.** From uncommon up, physical items carry a survivability secondary: HP, lifesteal, or armor (Warded Longsword uses magic resist instead).
5. **Few hybrids.** Items that boost both physical and magic, or both armor and magic resist, are rare: 3 and 2 in this catalog.
6. **Uniqueness by rarity.** Commons may be near-copies. Uncommons add a small twist. Each rare has a theme and a stat mix no other item has. Each epic adds one signature effect. Relics are defined by their effect.
7. **Nothing protects streaks.** No item, relic or effect may soften a streak reset or reward missing.

Primary-stat guide by rarity (gated items run a step above the same rarity in the base pool; the L30 wave higher still):

| Theme | Common | Uncommon | Rare | Epic |
|---|---|---|---|---|
| Physical | 3–5% | 10% + survival | 22–24% + survival | 42–45% + survival + signature |
| Magic | 4–6% | 13–16% | 28–34%, or ~40% with a drawback | 55% + signature |
| True | 5% | 12% | 25% | (relics only) |
| Tank | 3–6% HP / 75 armor or MR | 10% HP / 150 | 25–45% HP / 150–450 | 20–35% HP + signature |
| Support | 3–6% | 10–15% | 30% healing / 15% EXP | 30% + signature |

## Confirmed product decisions

- **Consumables stay in the main equip slots.** Phoenix Feather remains the only consumable; it's strong enough to earn its slot.
- **Relics replace the side-only item pool** (details below). The 8 original rares/epics that could be flagged side-only return to normal drops.
- **Slots go 4 → 6 → 8.** The existing `item-slots` event (L7+) is joined by a second one-time event at L20+.
- **Locked slots are shown.** The item grid always shows all 8 cells; locked ones are dimmed with a lock icon and no text.
- **Regen exists only on the Ember Heart relic, at 5%.**
- **Drawbacks are allowed** as negative percents (e.g. −10% max HP), shown with a minus sign.

## Catalog

Status: **kept** (unchanged), **changed** (same id/icon, new stats), **new** (needs art). Sig = epic signature effect.

### Base pool — always droppable (35)

**Physical**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Rusty Blade | common | +3% physical | kept |
| Steel Sword | common | +5% physical | changed (was 6) |
| Warlord's Greatsword | uncommon | +10% physical, +5% HP | changed |
| Runed Warblade | uncommon | +10% physical, +75 armor | changed (was a phys/magic hybrid) |
| Vampiric Fang | uncommon | +6% physical, +3% lifesteal | changed (was 5% lifesteal) |
| Executioner's Axe | rare | +22% physical, +150 armor | changed |
| Berserker's Fury | rare | +28% physical, +15% crit, −10% max HP | changed — **exception**: reckless physical |
| Godslayer Greatblade | epic | +42% physical, +10% HP, +3% lifesteal · Sig: +30% damage while the boss is above 75% HP | changed |

**Magic**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Apprentice Wand | common | +4% magic | changed |
| Arcane Staff | common | +6% magic | kept |
| Archmage's Rod | uncommon | +13% magic | changed |
| Stormcaller Staff | rare | +30% magic, +6% crit | changed |
| Void Crystal | rare | +38% magic, −10% max HP | changed |
| Voidcaller's Scepter | epic | +55% magic, +8% crit · Sig: magic crits deal ×3 instead of ×2 | changed |

**True and crit**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Bone Needle | common | +5% true damage | new |
| Silver Stiletto | uncommon | +12% true damage | new |
| Truthseeker's Bow | rare | +25% true damage, +8% crit | new |
| Lucky Dagger | common | +2% crit | kept |
| Assassin's Edge | common | +5% crit | kept |
| Eagle Eye Lens | uncommon | +10% crit | kept |

**Hybrid (physical + magic)**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Battlemage Gauntlets | common | +4% physical, +4% magic | kept |
| Chaos Blade | rare | +15% physical, +15% magic | kept |

**Tank**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Padded Vest | common | +3% HP | kept |
| Chainmail Hauberk | common | +6% HP | kept |
| Iron Buckler | common | +75 armor | new |
| Ward Cloak | common | +75 magic resist | new |
| Plate Armor | uncommon | +10% HP | kept |
| Dragon's Heart | rare | +20% HP, +10% physical | kept |

**Support and consumable**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Novice's Charm | common | +3% healing | kept |
| Blessed Censer | common | +6% healing | kept |
| Sacred Chalice | uncommon | +10% healing | kept |
| Lucky Coin | common | +3% EXP | kept |
| Shining Star | common | +6% EXP | kept |
| Rebirth Orb | uncommon | +10% EXP | kept |
| Phoenix Feather | rare | Consumable: one revive at 50% HP | kept |

### Level-gated — random unlock at L10 / 15 / 20 per run (28)

Same shuffle as today (`assignNewItemUnlockTiers`); with 28 items, `Math.ceil(28/3)` gives tiers of 10/10/8.

**Physical**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Warded Longsword | uncommon | +10% physical, +100 magic resist | changed |
| Berserker's War Axe | rare | +24% physical, +4% lifesteal | changed (was +200 flat) |
| Serrated Ripper | rare | +24% physical, +20% armor pen, +10% HP | changed (was +150 flat) |
| Piercing Fang Gauntlets | rare | +20% physical, +35% armor pen, +150 armor | changed (was epic) |
| Duelist's Signet | rare | +18% physical, +10% crit, +2% lifesteal | changed (was 4 small stats) |
| Bloodthorn Blade | epic | +45% physical, +10% HP, +3% lifesteal · Sig: crits heal 5% of max HP | changed |

**Magic**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Scholar's Grimoire | uncommon | +10% magic, +5% magic pen, +10% EXP | changed (was +100 flat) |
| Hexed Ring | uncommon | +16% magic, −5% max HP | new |
| Chaos Conduit | rare | +34% magic, +20% magic pen | changed (was 30%) |
| Cinder Crown | rare | +42% magic, −20% healing | new |
| Runeforged Spellblade | epic | +55% magic, +15% magic pen · Sig: Spellweave — each skill checked today adds +5% magic damage (max +25%), resets at rollover | changed (was +400 flat, +100 MR) |

**Tank**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Warding Sigil | uncommon | +10% HP, +150 magic resist | kept |
| Bulwark Plate | rare | +25% HP, +10% healing | changed (was +10%, +500 flat) |
| Juggernaut Carapace | rare | +450 armor, +15% HP, −10% physical | changed (was 300 armor, +200 flat HP) |
| Penitent's Hauberk | rare | +150 armor, +25% healing | new |
| Ascetic's Beads | rare | +150 armor, +150 magic resist, +15% true damage | new — **exception**: armor + MR |
| Brawler's Ironhide | rare | +250 armor, +10% physical, +8% crit | new |
| Spellturner Mantle | rare | +300 magic resist, +15% magic | new — **exception**: magic with defense |
| Aegis of the Unbroken | epic | +35% HP, +50 armor, +50 magic resist · Sig: immune to Wounds | changed — **exception**: armor + MR |
| Bloodbound Carapace | epic | +30% HP, +3% lifesteal · Sig: bosses can't lifesteal from you | new |
| Dawnguard Helm | epic | +20% HP, +300 armor · Sig: the first hit each day deals half damage | new |

**Support**

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Serene Lotus Charm | uncommon | +12% healing, +12% EXP | kept |
| Pilgrim's Blessing | uncommon | +15% healing, +5% HP, +5% EXP | changed (was +100 flat) |
| Stalwart Sage's Ring | uncommon | +100 magic resist, +8% healing | changed (was armor + MR) |
| Font of Renewal | rare | +30% healing, +5% EXP | changed (was +200 flat) |
| Adventurer's Sigil | rare | +15% EXP, +10% HP | changed (was 4 stats) |
| Titan's Lifeblood | epic | +30% healing, +20% HP · Sig: healing skills heal +50% while you're below half HP | changed (was +1000 flat HP) |
| Sage's Codex | epic | +15% EXP, +15% healing · Sig: level-ups heal 40% instead of 20% | new |

### L30 wave — fixed unlock at level 30 (5)

Not shuffled: these are the late-game pinnacle, reached around boss 25.

| Item | Rarity | Bonuses | Status |
|---|---|---|---|
| Starfall Staff | epic | +75% magic, −20% max HP · Sig: the first magic skill each day always crits | new |
| Worldbreaker Maul | epic | +55% physical, +20% HP, +3% lifesteal · Sig: ignores the armor bonus from a boss's type (armored bosses resist like a normal boss) | new |
| Colossus Plate | rare | +45% HP, +350 armor | new |
| Archon's Halo | rare | +40% healing, +15% EXP | new |
| Sunpiercer Bow | rare | +40% true damage, +12% crit | new |

## Relics

Side-quest-only items, defined by their effect. Each also carries base stats in a mix no other relic shares; relics with narrower effects get bigger stats.

### Pool rules

- New rarity `relic`, using the existing side-quest color. Relics never drop from bosses or the `item-drop` event.
- Each relic has an unlock level (1, 15 or 30). A side quest pays a random relic that is unlocked at the player's level, not yet earned this run, and not promised to another pending side quest.
- **Earned is earned:** once a relic has been paid out this run (`Character.earnedRelicIds`), it isn't offered again that run, whether the player keeps or drops it. Grinding side quests always shows something new, and works toward the relic the player wants.
- A missed side quest returns its relic to the pool (unchanged from today).
- The side-quest event's eligibility becomes "any relic is available," and the existing `SIDE_QUEST_GUARANTEE_LEVELS` guarantee stays as is.
- Relics take normal slots. No cap on equipped relics at first; revisit if stacking gets out of hand.
- Some relics do nothing for some runs (no weeklies, no bad skills, etc.). That is intended.

### Catalog (15)

| Relic | Unlocks | Base stats | Effect |
|---|---|---|---|
| Ember Heart | L1 | +10% HP, +10% healing | Heal 5% of max HP at each daily rollover |
| Soul Lantern | L1 | +12% healing, +5% EXP | Heal 15% of max HP when a boss falls |
| First Blood | L1 | +15% physical, +3% lifesteal | Your first hit on each new boss always crits |
| Censer of Wrath | L1 | +20% healing, +100 armor | Healing skills also hit the boss for half of what they heal (as true damage, no crit; uses the amount before the max-HP cap, so it works at full health) |
| Temperance Seal | L1 | +20% true damage, +15% HP | Resisted bad skills hit 50% harder |
| Quill of Oaths | L1 | +10% EXP, +10% magic | Quests pay +50% EXP |
| Magpie Charm | L1 | +8% crit, +3% lifesteal | Item drops roll rarity as if from a boss 10 indexes later (no effect from boss ~10 on) |
| Headsman's Mark | L15 | +15% physical, +20% armor pen, +10% HP | +50% damage to a boss below 25% HP |
| Hunter's Eye | L15 | +12% crit, +15% true damage | Crits ignore armor and magic resist |
| Moonwell | L15 | +20% healing, +15% magic | Weekly skills deal ×1.5 |
| Dynamo Core | L15 | +20% magic, +10% crit | Overdrive uses deal full damage instead of half |
| Banner of Endurance | L15 | +12% physical, +15% HP | Streak milestones pay double EXP |
| Null Mirror | L30 | +300 magic resist, +25% HP | Boss reflect can't touch you |
| Echoing Blade | L30 | +20% physical, +20% magic | Overkill damage carries into the next boss (that boss only; it can't kill it) — **exception**: hybrid |
| Glass Crown | L30 | +40% all damage, −30% max HP | The trade-off is the effect — **exception**: all damage types |

None of the EXP effects scale with boss index (quest EXP follows the level curve, milestone EXP is fixed), so none can feed the EXP-vs-boss-health runaway `BOSS_EXP_GROWTH_RATE` guards against.

## Slots

- `maxEquipSlots`: 4, then 6 after `item-slots`, then 8 after a new one-time event `item-slots-2` (min level 20, eligible only once `item-slots` is taken). Event card copy stays terse, same as the existing one.
- **Item grid:** always 8 cells, 4 columns × 2 rows; locked cells dimmed with a lock icon. At 46px per cell the grid is 196px wide, which fits beside the sprite on a 375px phone. Tap targets stay at least 44px.
- **Hero modal Equipment list:** after the "Empty slot" rows, one "Locked" row per locked slot.
- Mock up the locked-slot grid in Ashen before building.

## Engine changes

- `ItemRarity` gains `'relic'`. `ItemDef` gains `unlockLevel?: number` (fixed unlock: L30 wave and relics) alongside today's `levelGated` (random 10/15/20), and `effect?: ItemEffectId` for epic signatures and relic effects.
- `BoostableStat` gains `'allDamage'` (Glass Crown), which feeds the physical, magic and true multipliers. Percents may be negative; `describeItemBonusParts` renders them with a minus sign.
- Flat bonuses survive only for armor and magic resist. `itemFlatBonus` stays for those.
- **Enchant (`double-item`)** doubles positive bonuses only; drawbacks and effects are unchanged. Relics can be enchanted.
- **Drop pool:** relics are always excluded; L30 items require level 30.
- **Side quests:** `sideOnlyItemIds`, `assignSideOnlyItems`, `isSideOnlyCandidate` and `TUNING.SIDE_QUEST_ITEM_COUNT` are removed. `availableSideOnlyItems` becomes "available relics".
- **Effect hooks**, all at existing seams:
  - `completeHabit`: Godslayer, Voidcaller, Bloodthorn, Spellweave, Starfall, Worldbreaker, Titan's Lifeblood, First Blood, Headsman's Mark, Hunter's Eye, Moonwell, Dynamo Core, Censer of Wrath, Null Mirror, Temperance Seal (a resisted bad skill's reward resolves through `completeHabit`, see `useCombatActions`).
  - `missHabit`: Aegis, Bloodbound, Dawnguard.
  - Daily rollover: Ember Heart.
  - `resolveBossDefeatIfDead`: Soul Lantern, Echoing Blade, Magpie Charm.
  - `addExpAndResolveLevelUps`: Sage's Codex. Quest reward: Quill of Oaths. Milestone EXP: Banner of Endurance.
- **New per-run state:**
  - `Character.earnedRelicIds`
  - Per-day keys for the once-a-day effects: Dawnguard's halved hit, Starfall's crit, and Spellweave's hit count.
  - A boss flag for First Blood: whether the player has hit this boss yet.

## Migration

- Stat changes apply in place, since item stats are looked up from the catalog by id. No schema bump.
- `newItemUnlockTiers`: existing runs keep their assignments; the 9 new gated ids get random tiers backfilled.
- `sideOnlyItemIds` is dropped. A pending side quest that already promised an old item still pays that item. `earnedRelicIds` starts empty.
- Characters already past level 20 with `item-slots` taken become eligible for `item-slots-2` at their next pick.

## Calibration

This pass raises top-end item power (magic epics at 55%, the L30 wave, relics on top of gear). After implementation, re-run the 52-week sim behind `EXPECTED_LEVEL_BY_BOSS_INDEX` and check that boss pacing still holds. Boss-curve changes are out of scope unless the sim shows a large swing.

## Art

34 new icons: 5 base-pool, 9 gated, 5 L30-wave, 15 relics. Source from `HabitRPG/habitica-images` like the existing items, until original art replaces them.

## Testing

- `items.spec.ts`: no catalog item has a flat bonus on physical, magic, true, healing or health; negative percents reduce stats; `allDamage` feeds all three damage multipliers; relics never appear in `rollItemDrops` or the `item-drop` pool; L30 items drop only at level 30+; the unlock-tier shuffle partitions all 28 gated ids; Enchant leaves drawbacks unchanged.
- Catalog rule checks, as tests: at most 3 phys+magic hybrids and 2 armor+MR items; every physical item uncommon or rarer (except the flagged Berserker's Fury) carries HP, lifesteal, armor or magic resist; every epic has an effect.
- `events.spec.ts`: `item-slots-2` gating; side-quest eligibility tracks available relics; an earned relic is never re-offered this run; a missed side quest's relic returns.
- `combat.spec.ts` / `leveling.spec.ts`: one test per effect hook.
- Migration: unlock-tier backfill keeps existing assignments; a pending old side quest still pays its item.

## Suggested phasing

1. **Catalog and stat rules:** percent conversion, archetype restats, negative percents, `allDamage`, new stat-only items, true items, L30 wave.
2. **Slots:** `item-slots-2` and the locked-slot grid (mockup first).
3. **Relics and side quests.**
4. **Epic signatures.**

## Open questions

1. **Relic equip cap:** none for now.

## Out of scope

- Boss-curve retuning (see Calibration).
- Weighting drops toward the player's skill types (decided against).
- New consumables.
- Set bonuses, slot types, selling.
