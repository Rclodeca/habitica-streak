# Item Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the item catalog to the archetype rules (percent-only scaling stats, magic glass cannon vs. physical sustain, themed rares, epic signatures), add the L30 wave, 8 equip slots with locked-slot display, and side-quest-only relics.

**Architecture:** The catalog moves to a data module (`constants/itemCatalog.ts`); `items.ts` keeps types and item helpers. A new `itemEffects.ts` holds effect lookups and the per-effect math, called from the existing seams in `combat.ts`, `leveling.ts`, `quests.ts` and `useDailyRollover`. Relics are catalog items with rarity `relic`, excluded from drops and paid out by side quests.

**Tech Stack:** Vue 3 + TypeScript + Pinia, Vitest (`npx vitest run`), `vue-tsc -b` via `npm run build`.

**Spec:** `docs/superpowers/specs/2026-10-23-item-rework-design.md`. All item stats, unlock levels and effect numbers come from its Catalog and Relics tables. Copy them exactly.

## Global Constraints

- Damage, healing and health bonuses are always `percent`; only `armor`/`magicResist` use `flat`. Armor pen / magic pen stay percents.
- Drawbacks are negative `percent` values. Display them with U+2212 (`−10%`), never a hyphen.
- No schema-version bump. Old saves migrate in place, with optional fields read as "none".
- Player-facing copy is terse and doesn't explain mechanics. Effect text uses the exact strings in Task 1.
- Mobile first: tap targets of at least 44px, nothing important hidden behind hover. Components never call `localStorage` directly.
- Nothing may protect a streak.
- Work directly on `main`. **Don't commit.** The user commits and pushes explicitly. Each task ends with a green full suite instead.

## Review Focus

1. **An old save whose equipped items changed stats**, with a pending side quest promising a pre-relic side-only item (e.g. `godslayer-greatblade`). It should load, and completing the quest should still pay that item. Pinned in Task 4.
2. **An in-progress run's `newItemUnlockTiers` missing the 9 new gated ids.** They must be backfilled so they can drop, without reshuffling existing ids. Pinned in Task 1.
3. **Every drawback equipped at once** (Glass Crown, Starfall Staff, Void Crystal, Hexed Ring). Max HP must stay positive. Pinned in Task 1.
4. **Enchanting a drawback item** must double only its positive bonuses. Pinned in Task 1.
5. **A huge Echoing Blade overkill** must leave the next boss at 1+ HP and never chain into a second defeat. Pinned in Task 6.

---

### Task 1: Item model and the new catalog

**Files:**
- Create: `src/game-engine/constants/itemCatalog.ts`
- Modify: `src/game-engine/items.ts`, `src/game-engine/leveling.ts`, `src/game-engine/character.ts`, `src/game-engine/index.ts`, `src/components/ui/statIcons.ts`
- Test: `src/game-engine/items.spec.ts`, `src/game-engine/leveling.spec.ts`, `src/game-engine/character.spec.ts`, plus existing specs that hard-code old catalog values (`combat.spec.ts`, `leveling.spec.ts`, store/composable specs)

**Interfaces:**
- Produces (in `items.ts`):
  - `type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'relic'`
  - `type DropRarity = Exclude<ItemRarity, 'relic'>`, used for the rarity-weight tables
  - `BoostableStat` gains `'allDamage'`
  - `type ItemEffectId = 'giantslayer' | 'void-crits' | 'bloodthorn' | 'spellweave' | 'wound-immune' | 'bloodbound' | 'dawnguard' | 'titans-mending' | 'sages-insight' | 'starfall' | 'worldbreaker' | 'ember-heart' | 'soul-lantern' | 'first-blood' | 'censer-of-wrath' | 'temperance' | 'quill-of-oaths' | 'magpie' | 'headsman' | 'hunters-eye' | 'moonwell' | 'dynamo' | 'banner' | 'null-mirror' | 'echoing-blade'`
  - `ItemDef` gains `unlockLevel?: number`, `effect?: ItemEffectId` and `effectText?: string`
  - `ITEM_CATALOG` is re-exported from `constants/itemCatalog.ts`
  - `backfillUnlockTiers(tiers: Record<string, 10|15|20>, rng: Rng): Record<string, 10|15|20>`
- Produces (in `leveling.ts`): `itemStatMultiplier` adds `itemBonusPercent(character, 'allDamage')` for `physicalDamage`/`magicDamage`/`trueDamage` only.

- [ ] **Step 1: Write the failing catalog tests in `items.spec.ts`**

Replace the old count/flat-item tests (30 original, 49 total, 19 gated, Bloodthorn's 4-bonus shape, Titan's +1000 flat, `berserkers-war-axe` +200 flat) with:

```ts
it('has 83 items with unique ids: 35 always-drop, 28 random-gated, 5 at L30, 15 relics', () => {
  expect(new Set(ITEM_CATALOG.map((i) => i.id)).size).toBe(83);
  expect(ITEM_CATALOG.filter((i) => i.rarity === 'relic')).toHaveLength(15);
  expect(ITEM_CATALOG.filter((i) => i.levelGated)).toHaveLength(28);
  expect(ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && i.unlockLevel === 30)).toHaveLength(5);
  expect(ITEM_CATALOG.filter((i) => i.rarity !== 'relic' && !i.levelGated && !i.unlockLevel)).toHaveLength(35);
});
it('never puts a flat bonus on a scaling stat', () => {
  const scaling = ['physicalDamage', 'magicDamage', 'trueDamage', 'healing', 'health', 'allDamage'];
  for (const item of ITEM_CATALOG) for (const b of item.bonuses) if (scaling.includes(b.stat)) expect(b.flat).toBeUndefined();
});
it('has at most 3 physical+magic hybrids and 2 armor+magicResist items', () => { /* count via bonuses */ });
it('gives every physical-themed item, uncommon and up, a survivability bonus — except Berserker\'s Fury', () => {
  // physical-themed = its largest positive damage bonus is physicalDamage; survivability = health/lifesteal/armor/magicResist > 0
});
it('gives every epic an effect and effectText', () => {});
it('gives every relic an unlockLevel of 1, 15 or 30', () => {});
```

Also add:
- `describeItemBonusParts(void-crystal)` contains `{ stat: 'health', text: '−10%' }`.
- `describeItemBonus(godslayer-greatblade)` ends with ` · Fells the mighty.`
- Enchant: with `doubledItemId: 'void-crystal'`, `itemBonusPercent(c, 'magicDamage')` is `76` and `itemBonusPercent(c, 'health')` is `-10`.
- Drawback stack: a level-1 character with `glass-crown`, `starfall-staff`, `void-crystal` and `hexed-ring` equipped has `effectiveStat(c, 'health') > 0`.
- `rollItemDrops` over many rolls, for a level-40 character, never returns a `relic`. For a level-29 character it never returns an `unlockLevel: 30` item; for a level-30 character it eventually does.
- `itemStatMultiplier(c with glass-crown, 'magicDamage')` is `1.4`, and the `'healing'` multiplier is `1`.
- `backfillUnlockTiers({ 'chaos-conduit': 15 }, rng)` keeps `chaos-conduit: 15` and assigns every other gated id to one of 10/15/20.

- [ ] **Step 2: Run and confirm the new tests fail**

Run: `npx vitest run src/game-engine/items.spec.ts`
Expected: FAIL (catalog size 49, no `relic` rarity).

- [ ] **Step 3: Create `constants/itemCatalog.ts` with all 83 items**

Move `ITEM_CATALOG` here, typed `ItemDef[]`, using a type-only import from `../items` (no runtime cycle). Take every value from the spec's Catalog and Relics tables:
- **Always-drop items:** no `levelGated`, no `unlockLevel`.
- **Random-gated items:** `levelGated: true`.
- **L30 wave:** `unlockLevel: 30`.
- **Relics:** `rarity: 'relic'`, with `unlockLevel` from the table.
- **Glass Crown:** `{ stat: 'allDamage', percent: 40 }` plus `{ stat: 'health', percent: -30 }`.

New ids use the item name in kebab case: `bone-needle`, `silver-stiletto`, `truthseekers-bow`, `iron-buckler`, `ward-cloak`, `hexed-ring`, `cinder-crown`, `penitents-hauberk`, `ascetics-beads`, `brawlers-ironhide`, `spellturner-mantle`, `bloodbound-carapace`, `dawnguard-helm`, `sages-codex`, `starfall-staff`, `worldbreaker-maul`, `colossus-plate`, `archons-halo`, `sunpiercer-bow`, `ember-heart`, `soul-lantern`, `first-blood`, `censer-of-wrath`, `temperance-seal`, `quill-of-oaths`, `magpie-charm`, `headsmans-mark`, `hunters-eye`, `moonwell`, `dynamo-core`, `banner-of-endurance`, `null-mirror`, `echoing-blade`, `glass-crown`.

`effect` / `effectText` (exact copy):

| Item | effect | effectText |
|---|---|---|
| godslayer-greatblade | giantslayer | Fells the mighty. |
| voidcallers-scepter | void-crits | Its crits tear deeper. |
| bloodthorn-blade | bloodthorn | Crits mend you. |
| runeforged-spellblade | spellweave | Grows with every deed today. |
| aegis-of-the-unbroken | wound-immune | Wounds cannot take hold. |
| bloodbound-carapace | bloodbound | Nothing feeds on you. |
| dawnguard-helm | dawnguard | The first blow each day is softened. |
| titans-lifeblood | titans-mending | Mends deeper when you falter. |
| sages-codex | sages-insight | Each level restores more. |
| starfall-staff | starfall | The first spell each day strikes true. |
| worldbreaker-maul | worldbreaker | Breaks the hardest shells. |
| ember-heart | ember-heart | Warmth returns each dawn. |
| soul-lantern | soul-lantern | Each fallen foe restores you. |
| first-blood | first-blood | The first strike lands deep. |
| censer-of-wrath | censer-of-wrath | Your mending burns your foe. |
| temperance-seal | temperance | Restraint strikes harder. |
| quill-of-oaths | quill-of-oaths | Oaths kept pay more. |
| magpie-charm | magpie | Finds finer things. |
| headsmans-mark | headsman | Finishes the weak. |
| hunters-eye | hunters-eye | Crits find the gaps. |
| moonwell | moonwell | Weekly deeds strike harder. |
| dynamo-core | dynamo | Overdrive at full force. |
| banner-of-endurance | banner | Endurance is rewarded. |
| null-mirror | null-mirror | Reflections cannot reach you. |
| echoing-blade | echoing-blade | Its echo carries on. |

Icons follow the existing `items/<id>` convention; the art arrives in Task 2.

- [ ] **Step 4: Update `items.ts` helpers**

- **Types:** add the new types from Interfaces. `rarityWeightByBossIndex` and its weight tables become `Record<DropRarity, number>`.
- **`itemBonusPercent`:** multiply by `itemDoubleFactor` only when `bonus.percent > 0`. Do the same for flat bonuses in `itemFlatBonus`.
- **`unownedDroppableItems`:** exclude `rarity === 'relic'` and items with `unlockLevel > character.level`. Keep the `levelGated` tier check.
  - Leave the `sideOnlyItemIds` filter in place; Task 4 removes it.
- **`describeItemBonusParts`:**
  - Positive bonuses render `+N%` / `+N`.
  - Negative bonuses render `−N%` with U+2212.
  - The parts list is still empty only for consumables.
- **`describeItemBonus`:** appends `` ` · ${item.effectText}` `` when `effectText` is set.
- **`STAT_SHORT_LABEL` / `STAT_LABEL`:** `allDamage` is `'All damage'` in both.
- **`bodySpriteFor`:** only considers bonuses with a positive `percent` / `flat`.
- **`backfillUnlockTiers`:** gives each missing gated id a random tier via `pickRandom([10, 15, 20], rng)` and keeps existing entries untouched.
- **`leveling.ts`:** `itemStatMultiplier` adds the `allDamage` percent for the three damage stats.
- **`statIcons.ts`:** `BOOST_STAT_ICON.allDamage = 'hit'`.

- [ ] **Step 5: Backfill unlock tiers for in-progress runs**

In `migrateCharacter` (`character.ts`), when `newItemUnlockTiers` exists but lacks any gated id, replace it with `backfillUnlockTiers(existing, rng)`.

Test in `character.spec.ts`: a saved character whose tiers cover only the old 19 ids comes back covering all 28, with the old 19 unchanged.

- [ ] **Step 6: Run the full suite and fix catalog-value fallout**

Run: `npx vitest run`

Specs that hard-code old values need updating:
- `vampiric-fang` lifesteal 5 → 3.
- `juggernaut-carapace` armor 300 → 450 (use `itemFlatBonus(character, 'armor')` instead of a literal).
- `chaos-conduit` magic 30 → 34.
- Old count/shape tests.

Delete tests whose subject no longer exists, i.e. a flat damage or health bonus on a real item (the `berserkers-war-axe` flat-before-streak test, the `bulwark-plate` flat-health test). Keep `bodySpriteFor`'s flat-fallback test only if a catalog item still exercises it; otherwise delete it.

Expected: all green.

---

### Task 2: Icon art for the 34 new items

**Files:**
- Create: `public/sprites/items/<id>.png` × 34
- Modify: `CREDITS.md` (one table row per new icon, same format as the existing rows)
- Test: `src/game-engine/items.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('has an icon file for every catalog item', () => {
  for (const item of ITEM_CATALOG) expect(existsSync(resolve(__dirname, '../../public/sprites', `${item.icon}.png`))).toBe(true);
});
```

- [ ] **Step 2: Run it and confirm it fails** on the 34 new ids.

- [ ] **Step 3: Download each icon** from `https://raw.githubusercontent.com/HabitRPG/habitica-images/main/<source>` into `public/sprites/items/<id>.png`:

| id | source |
|---|---|
| bone-needle | gear/armoire/shop/shop_weapon_armoire_needleOfBookbinding.png |
| silver-stiletto | gear/armoire/shop/shop_weapon_armoire_resplendentRapier.png |
| truthseekers-bow | gear/armoire/shop/shop_weapon_armoire_jeweledArcherBow.png |
| iron-buckler | gear/shield/shop/shop_shield_warrior_1.png |
| ward-cloak | gear/armoire/shop/shop_armor_armoire_secretsCloak.png |
| hexed-ring | gear/armoire/shop/shop_weapon_armoire_batWand.png |
| cinder-crown | gear/armoire/shop/shop_head_armoire_crownOfHearts.png |
| penitents-hauberk | gear/armoire/shop/shop_armor_armoire_gildedKnightsPlate.png |
| ascetics-beads | gear/armoire/shop/shop_body_armoire_karateBlackBelt.png |
| brawlers-ironhide | gear/armoire/shop/shop_armor_armoire_ogreArmor.png |
| spellturner-mantle | gear/armoire/shop/shop_armor_armoire_crystalCrescentRobes.png |
| bloodbound-carapace | gear/armoire/shop/shop_armor_armoire_vermilionArcherArmor.png |
| dawnguard-helm | gear/armoire/shop/shop_head_armoire_gildedKnightsHelm.png |
| sages-codex | gear/armoire/shop/shop_shield_armoire_unfinishedTome.png |
| starfall-staff | gear/armoire/shop/shop_weapon_armoire_shootingStarSpell.png |
| worldbreaker-maul | gear/armoire/shop/shop_weapon_armoire_ogreClub.png |
| colossus-plate | gear/armoire/shop/shop_armor_armoire_stormKnightArmor.png |
| archons-halo | gear/armoire/shop/shop_head_armoire_goldenLaurels.png |
| sunpiercer-bow | gear/armoire/shop/shop_weapon_armoire_vermilionArcherBow.png |
| ember-heart | gear/armoire/shop/shop_shield_armoire_darkAutumnFlame.png |
| soul-lantern | gear/armoire/shop/shop_weapon_armoire_skullLantern.png |
| first-blood | gear/armoire/shop/shop_weapon_armoire_corsairsBlade.png |
| censer-of-wrath | gear/armoire/shop/shop_weapon_armoire_vernalTaper.png |
| temperance-seal | gear/armoire/shop/shop_shield_armoire_alchemistsScale.png |
| quill-of-oaths | gear/armoire/shop/shop_shield_armoire_mightyQuill.png |
| magpie-charm | gear/armoire/shop/shop_weapon_armoire_finelyCutGem.png |
| headsmans-mark | gear/armoire/shop/shop_weapon_armoire_stormKnightAxe.png |
| hunters-eye | gear/armoire/shop/shop_eyewear_armoire_jewelersEyeLoupe.png |
| moonwell | gear/armoire/shop/shop_weapon_armoire_lunarSceptre.png |
| dynamo-core | gear/armoire/shop/shop_shield_armoire_polishedPocketwatch.png |
| banner-of-endurance | gear/armoire/shop/shop_shield_armoire_verdantBanner.png |
| null-mirror | gear/armoire/shop/shop_shield_armoire_midnightShield.png |
| echoing-blade | gear/armoire/shop/shop_weapon_armoire_mythmakerSword.png |
| glass-crown | gear/armoire/shop/shop_head_armoire_crownOfDiamonds.png |

If any path 404s, look it up in the repo tree (`git/trees/main?recursive=1`) and pick the closest-themed icon. Note the swap in CREDITS.

- [ ] **Step 4: Run the test and confirm it passes.** `file` on each new PNG reports PNG image data.

---

### Task 3: Eight slots and locked-slot display

**Files:**
- Modify: `src/game-engine/items.ts`, `src/game-engine/events.ts`, `src/components/ui/statIcons.ts`, `src/components/character/CharacterPanel.vue`, `src/assets/scss/themes/ashen.scss` (only if its `.item-slot`/`.gear-row` overrides need a `.locked` rule)
- Test: `src/game-engine/items.spec.ts`, `src/game-engine/events.spec.ts`

**Interfaces:**
- Produces:
  - `MAX_EQUIP_SLOTS = 8` exported from `items.ts`
  - `maxEquipSlots(character)` returns 4 / 6 / 8
  - `EventId` gains `'item-slots-2'`

- [ ] **Step 1: Write the failing tests**
  - `maxEquipSlots` is 8 with `takenEventIds: ['item-slots', 'item-slots-2']`.
  - `eligibleEvents` includes `item-slots-2` only at level ≥ 20 and only once `item-slots` is taken. It's one-time.

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement**
  - `EVENT_DEFS` entry: `{ id: 'item-slots-2', title: 'More item slots', description: 'Your equipment slots increase from 6 to 8.', minLevel: 20, oneTime: true, isEligible: (c) => c.takenEventIds?.includes('item-slots') ?? false }`.
  - `EVENT_ICON['item-slots-2'] = 'slots'`.
  - `useEventChoice.choose`'s fallthrough branch already logs `item-slots-gained`; leave it.

- [ ] **Step 4: Run the tests and confirm they pass.**

- [ ] **Step 5: Change the `CharacterPanel.vue` grid**
  - The grid always renders `MAX_EQUIP_SLOTS` cells in 4 columns. Cells at index ≥ `slotCount` get class `locked`: dimmed (opacity ~0.35), a lucide `Lock` icon at 18px, no tooltip, no click.
  - Remove the 2/3-column switch. Max width becomes `4 * 46 + 3 * 4 = 196px`.
  - In the hero modal Equipment list, after the `Empty slot` rows, render one `<li class="gear-row locked">Locked</li>` per locked slot, styled like `.empty` but dimmer.
  - The spec asked for an Ashen mockup first. The user asked to implement directly, so the mockup is skipped and verified in Task 7's screenshots instead.

- [ ] **Step 6: Run `npx vitest run`** and confirm green.

---

### Task 4: Relics replace the side-only pool

**Files:**
- Modify: `src/game-engine/items.ts`, `src/game-engine/events.ts`, `src/game-engine/character.ts`, `src/game-engine/types.ts`, `src/game-engine/constants/tuning.ts`, `src/game-engine/index.ts`, `src/store/characterStore.ts`, `src/composables/useEventChoice.ts`, `src/components/ui/ItemHero.vue`, `src/components/ui/ItemDropPopup.vue`, `src/components/character/CharacterPanel.vue`
- Test: `src/game-engine/items.spec.ts`, `src/game-engine/events.spec.ts`, `src/game-engine/character.spec.ts`, `src/store/characterStore.spec.ts`, `src/composables/useEventChoice.spec.ts`, `src/composables/useCombatActions.spec.ts`

**Interfaces:**
- Produces:
  - `availableRelics(character: Character, quests: readonly Quest[]): ItemDef[]` (replaces `availableSideOnlyItems`): relics with `unlockLevel <= level`, not in `earnedRelicIds`, not owned, not a pending side quest's `rewardItemId`.
  - `recordRelicEarned(character: Character, itemId: string): Character`: appends to `earnedRelicIds` if the item is a relic and not already listed; otherwise returns the same object.
  - `Character.earnedRelicIds?: string[]`
- Removes: `assignSideOnlyItems`, `isSideOnlyCandidate`, `availableSideOnlyItems`, `Character.sideOnlyItemIds`, `TUNING.SIDE_QUEST_ITEM_COUNT`, and the side-only filter in `unownedDroppableItems`.

- [ ] **Step 1: Write the failing tests**
  - `availableRelics`, for a level-1 character, returns only the 7 L1 relics. At level 15 it returns 12 (7 L1 + 5 L15); at level 30 all 15. It excludes earned, owned and promised relics.
  - `recordRelicEarned` ignores non-relics.
  - `eligibleEvents` offers `side-quest` exactly when `availableRelics` is non-empty.
  - The `characterStore.grantItem('ember-heart')` → `discardItem('ember-heart')` sequence leaves `ember-heart` out of `availableRelics` (earned is earned).
  - `migrateCharacter` deletes `sideOnlyItemIds` from an old save.
  - `useCombatActions.completeQuest` on a side quest whose `rewardItemId` is `'godslayer-greatblade'` (pre-relic save) still grants that item. *(Review Focus 1.)*

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement**
  - `characterStore.grantItem` passes the new character through `recordRelicEarned`.
  - `createCharacter` drops the `sideOnlyItemIds` line.
  - `migrateCharacter` deletes a stray `sideOnlyItemIds`, the same way it already strips `expGain`.
  - `useEventChoice.chooseSideQuest` picks from `availableRelics`.
  - Rename the event's `isEligible` accordingly.
  - Add a `.rarity-relic { --rarity: var(--side-quest-color); }` rule next to the other rarity rules in `ItemHero.vue`, `ItemDropPopup.vue` and `CharacterPanel.vue`.

- [ ] **Step 4: Run `npx vitest run`** and confirm green. Delete the old side-only tests and rewrite events/useEventChoice tests that seeded `sideOnlyItemIds` to use relics.

---

### Task 5: Effects in `completeHabit`

**Files:**
- Create: `src/game-engine/itemEffects.ts`, `src/game-engine/itemEffects.spec.ts`
- Modify: `src/game-engine/combat.ts`, `src/game-engine/boss.ts`, `src/game-engine/types.ts`, `src/game-engine/constants/tuning.ts`, `src/game-engine/index.ts`, `src/composables/useCombatActions.ts`, `src/components/habits/HabitStatsModal.vue`
- Test: `src/game-engine/itemEffects.spec.ts`, `src/game-engine/combat.spec.ts`

**Interfaces:**
- Produces:
  - `TUNING.ITEM_EFFECTS = { GIANTSLAYER_ABOVE_PCT: 0.75, GIANTSLAYER_MULTIPLIER: 1.3, HEADSMAN_BELOW_PCT: 0.25, HEADSMAN_MULTIPLIER: 1.5, VOID_CRIT_MULTIPLIER: 3, BLOODTHORN_CRIT_HEAL_PCT: 5, SPELLWEAVE_PER_SKILL: 0.05, SPELLWEAVE_MAX_STACKS: 5, TITANS_MENDING_BELOW_PCT: 0.5, TITANS_MENDING_MULTIPLIER: 1.5, CENSER_DAMAGE_FRACTION: 0.5, TEMPERANCE_MULTIPLIER: 1.5, MOONWELL_MULTIPLIER: 1.5, BANNER_MILESTONE_MULTIPLIER: 2, DAWNGUARD_FACTOR: 0.5, SAGES_INSIGHT_LEVEL_UP_HEAL_PCT: 40, EMBER_HEART_HEAL_PCT: 5, SOUL_LANTERN_HEAL_PCT: 15, QUILL_EXP_MULTIPLIER: 1.5, MAGPIE_BOSS_INDEX_BONUS: 10 }`
  - `Character.effectDayKeys?: { dawnguard?: string; starfall?: string; emberHeart?: string }`: the day key each once-a-day effect last fired.
  - `Character.spellweave?: { dayKey: string; count: number }`
  - `Boss.playerHasHit?: boolean`, `Boss.overkill?: number`
  - In `itemEffects.ts`:
    - `hasItemEffect(character: Pick<Character, 'equippedItemIds'>, effect: ItemEffectId): boolean`
    - `effectDamageMultiplier(character: Character, habit: Habit, boss: Boss, currentDayKey: string): number` is the product of:
      - Giantslayer: a damage skill while `boss.health / boss.maxHealth > 0.75`
      - Headsman: a damage skill while the ratio is `< 0.25`
      - Moonwell: a weekly skill of any type
      - Spellweave: magic, `1 + 0.05 * min(count today, 5)`
      - Temperance: `habit.isBad`
    - `bumpSpellweave(character: Character, currentDayKey: string): Character`: the same object when Spellweave isn't equipped.
    - `isForcedCrit(character: Character, habit: Habit, boss: Boss, currentDayKey: string): boolean`
      - First Blood: `!boss.playerHasHit`
      - Starfall: a magic skill when `effectDayKeys.starfall !== currentDayKey`
    - `critMultiplierFor(character: Character, habit: Habit): number`: 3 for a magic skill with Voidcaller, else `TUNING.CRIT_MULTIPLIER`.
  - In `boss.ts`: `baseResistStatForIndex(index: number): number`, the non-personality resist stat (`resistStatForReduction(resistPctForIndex(index))`).
  - `HabitDamageBreakdown` gains `effectMultiplier`. `habitDamageBreakdown(character, habit, allHabitsOfSameType, boss, currentDayKey)` now takes boss and day key and folds `effectMultiplier` into `effectiveDamage`.

- [ ] **Step 1: Write the failing tests**

Unit tests in `itemEffects.spec.ts` for each helper above, plus one test per hook in `combat.spec.ts`. Each equips the real catalog item and compares against the same call without it (`noCritRng = () => 0.99`):
- Godslayer: ×1.3 at full boss HP, ×1 at 50%.
- Headsman's Mark: ×1.5 at 20% boss HP.
- Moonwell: a weekly ×1.5, a daily ×1.
- Spellweave: the 3rd magic skill today deals ×1.10 (2 prior stacks). The count resets on a new day key.
- Temperance Seal: an `isBad` reward ×1.5.
- Voidcaller: a forced magic crit deals ×3 of the non-crit amount.
- First Blood: the first hit on a boss crits even with `noCritRng`; the second doesn't. `result.boss.playerHasHit` is true.
- Starfall: the first magic skill today crits, the second doesn't. `effectDayKeys.starfall` is stamped.
- Hunter's Eye: a crit vs `armor: 1000` deals the unmitigated crit amount.
- Worldbreaker: a physical hit vs an armored boss uses `min(boss.armor, baseResistStatForIndex(boss.index))`.
- Dynamo Core: an Overdrive use deals full rather than half damage.
- Banner of Endurance: the streak-5 milestone pays `5 * 2`.
- Null Mirror: `reflectedDamage` is undefined against `reflectPct: 0.2`.
- Bloodthorn: a crit heals an extra 5% of max HP.
- Titan's Lifeblood: a heal below half HP is ×1.5, above half ×1.
- Censer of Wrath: a healing skill reduces boss health by half the pre-cap heal, unmitigated, and sets `damageDealt`.
- Echoing Blade bookkeeping: a killing hit sets `result.boss.overkill = dealt − bossHealthBefore`.

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement in `completeHabit`**

The order is fixed: `amount × effectDamageMultiplier`; crit = `rng() < chance || isForcedCrit` (always consume the `rng()` roll first so seeded sequences don't shift); crit uses `critMultiplierFor`; Hunter's Eye skips resist on a crit; Worldbreaker caps armor before pen; pen; reflect is 0 with Null Mirror; lifesteal plus Bloodthorn heal; stamp `playerHasHit`/`overkill` on the new boss; `bumpSpellweave`; stamp `effectDayKeys.starfall` when Starfall forced the crit.

In the healing branch: Titan's multiplier, then Censer damage to the boss. Dynamo sets the Overdrive factor to 1. Banner doubles `milestoneExp`. When no effect fires, the returned character must stay the same object (existing identity tests).

- [ ] **Step 4: `useCombatActions.applyReward`**

In the healing branch, when `result.damageDealt` is set, also log a `skill-damage` entry with `isTrueDamage: true`.

`HabitStatsModal.vue` passes the boss and today's key, and shows an `Effects ×N.NN` line only when `effectMultiplier !== 1`.

- [ ] **Step 5: Run `npx vitest run`** and confirm green.

---

### Task 6: Effects at the other seams

**Files:**
- Modify: `src/game-engine/combat.ts`, `src/game-engine/itemEffects.ts`, `src/game-engine/leveling.ts`, `src/game-engine/items.ts`, `src/game-engine/quests.ts`, `src/game-engine/index.ts`, `src/composables/useCombatActions.ts`, `src/composables/useDailyRollover.ts`, `src/store/activityLogStore.ts`, `src/components/ui/ActivityLog.vue`
- Test: `src/game-engine/combat.spec.ts`, `src/game-engine/itemEffects.spec.ts`, `src/game-engine/leveling.spec.ts`, `src/game-engine/items.spec.ts`, `src/game-engine/quests.spec.ts`, `src/composables/useDailyRollover.spec.ts`

**Interfaces:**
- Consumes: `hasItemEffect`, `TUNING.ITEM_EFFECTS`, `Character.effectDayKeys` and `Boss.overkill` from Task 5.
- Produces:
  - `applyDailyRegen(character: Character, currentDayKey: string): { character: Character; healed: number }` in `itemEffects.ts` (Ember Heart: heals 5% of max HP once per day key, stamping `effectDayKeys.emberHeart`; otherwise the same object and 0)
  - `questRewardExp(character: Character, difficulty: Difficulty, completedThisWeek: number): number` in `quests.ts` (`questSlotExp` × 1.5 with Quill of Oaths)
  - `resolveBossDefeatIfDead` returns an added `itemHealed?: number` (Soul Lantern)
  - Activity log kind `{ kind: 'item-heal'; itemName: string; amount: number }`

- [ ] **Step 1: Write the failing tests**
  - **`missHabit`:**
    - Aegis: a successful Wounds roll applies nothing, and the rng consumption count is unchanged.
    - Bloodbound: `bossLifestealHealed` is undefined and boss health is unchanged against `lifestealPct: 1`.
    - Dawnguard: the first hit of a day key deals half, the second full; the next day halves again.
  - **`resolveBossDefeatIfDead`:**
    - Soul Lantern heals 15% of max HP (capped) and returns `itemHealed`.
    - Echoing Blade lowers the next boss's health by `boss.overkill`.
    - With `overkill` greater than the next boss's max HP, the next boss sits at exactly 1 HP and `defeated` describes only the first boss. *(Review Focus 5.)*
    - Without Echoing Blade, `overkill` is ignored.
  - **Magpie:** `rollItemDrops` with `magpie-charm` equipped uses the rarity weights of `bossIndex + 10`. Assert it via the epic share over many seeded rolls at boss 1 versus without.
  - **Sage's Codex:** a level-up heals 40% of max HP instead of 20%.
  - **Quill of Oaths:** `questRewardExp` is ×1.5 with it, equal to `questSlotExp` without.
  - **Ember Heart in `useDailyRollover`:**
    - With `ember-heart`, the first run on a day heals 5% and logs `item-heal`.
    - A second run the same day doesn't heal.
    - Without the relic, the character is untouched.

- [ ] **Step 2: Run and confirm they fail.**

- [ ] **Step 3: Implement at each seam**
  - `useCombatActions.completeQuest` uses `questRewardExp`.
  - `applyReward` logs `item-heal` for `defeatResult.itemHealed`.
  - `useDailyRollover` applies `applyDailyRegen` through `characterStore.setCharacter` and logs `item-heal`.
  - `ActivityLog.vue` renders `item-heal` like `event-heal`, prefixed with the item name.

- [ ] **Step 4: Run `npx vitest run`** and confirm green.

---

### Task 7: Verification

- [ ] **Step 1:** `npx vitest run`: everything green, with the count above the 590 baseline.
- [ ] **Step 2:** `npm run build`: `vue-tsc` and the Vite build succeed with no type errors.
- [ ] **Step 3:** `npx eslint src`: no new errors in touched files. The known baseline has 2 `multi-word-component-names` errors.
- [ ] **Step 4:** Dev-server screenshots at 375px and desktop, Ashen and Minimalist themes. Check:
  - The 8-cell grid with locked cells beside the sprite, with no horizontal scroll.
  - The hero modal's Locked rows.
  - An item popup showing a drawback (`−10%`) and an effect line.
  - A relic's color.

  Use the debug popup preview or a seeded save in localStorage.
- [ ] **Step 5:** Update the `PROGRESS.md` items section. Note that the spec's calibration sim is a follow-up, since the repo has no sim script.
