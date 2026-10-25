# Fight Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked boss and hero panels with one frameless fight stage: boss top-right, hero bottom-left. It sits at the top of the page on phones and becomes a wide banner on desktop. The drop-down bar becomes plain status at every width.

**Architecture:**
- A new `FightStage.vue` owns the stage box, its fog, the tap-area split and the drop-down bar.
- `BossPanel.vue` and `CharacterPanel.vue` stay as the two halves. Each keeps its own data and modal, but its root becomes `display: contents`, so its pieces position absolutely inside the stage.
- Each half draws a transparent full-stage `<button>`, clipped by `clip-path` to its side of a stepped split. That makes the tap areas meet with no gap and no overlap, while hits and the "Slain" stamp are never clipped.

**Tech Stack:** Vue 3 (`<script setup>`, TS), Pinia, scoped CSS, SCSS theme file, Vitest + @vue/test-utils (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-25-fight-stage-design.md`. Executors must read it. The mocks it names are the visual reference.

## Before Task 1

`BossBar.vue`, `BossBar.spec.ts`, `BossPanel.vue`, `CharacterPanel.vue`, `AppShell.vue`, `ashen.scss` and other files hold another session's uncommitted work: the kill celebration and the drop-down bar. Ask the user whether to commit that work first, as its own commit, so this plan's commits hold only this plan's changes. Never revert it.

## Global Constraints

- **Breakpoint.** Phone layout is at or under 820px (`@media (max-width: 820px)`). Desktop and tablet are 821px and up. This matches `AppShell.vue` and `BossBar.vue`.
- **Theme rules.**
  - Ashen rules live only under `:root[data-theme='ashen']` in `src/assets/scss/themes/ashen.scss`.
  - The components' scoped styles are Minimalist.
  - Both themes share one layout.
- **Copy.** Player-facing copy is terse. No hint text such as "Tap to view".
- **Touch.** Tap targets are 44px or more, nothing depends on hover, and safe areas are respected.
- **No logic changes.** No change to combat math, stores or the save format. No new dependencies.
- **Animation cost.** No animated `filter: blur(...)`. Animate only `transform` and `opacity`, so it stays cheap on mid-range Android.
- **Narrow-phone scaling.** `.stage-inner` uses container query units (`cqw`). That needs iOS 16+ and Chrome 105+, which was accepted as the app-release floor.
- **Every commit:**
  - `npm run test:unit` and `npx vue-tsc -b` pass.
  - `npm run lint` adds no errors. Three errors already exist: the multi-word names on `Modal.vue` and `Sprite.vue`, and an unused `_` in `src/game-engine/quests.spec.ts:244`. Lint therefore exits non-zero, so run it on its own rather than chained with `&&`.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Stage geometry (used by Tasks 4–7)

All positions are inside `.stage-inner`.

**Phone** (`≤820px`, a 390px-wide, 300px-tall design):
- `.stage-inner` is `width: min(100%, 430px)`, centred, `height: 300px`, `container-type: inline-size`.
- `--u: min(1px, calc(100cqw / 390))` scales the art on phones narrower than 390px. Text and block insets stay in px.

| Piece | Position |
|---|---|
| Boss figure | `top: 0; right: calc(10 * var(--u)); width: calc(190 * var(--u))` |
| Boss platform | `right: calc(16 * var(--u)); top: calc(168 * var(--u)); width: calc(186 * var(--u)); height: 26px` |
| Boss block | `top: 10px; left: 16px; width: 196px` |
| Hero figure | `left: calc(var(--hero-x) * var(--u)); bottom: calc(var(--hero-y) * 1px); width: calc(var(--hero-w) * var(--u))` |
| Hero platform | `left: calc(4 * var(--u)); bottom: 4px; width: calc(152 * var(--u)); height: 26px` |
| Hero block | `bottom: 14px; right: 16px; width: 176px` |
| Split | `--split-x: 50%; --split-yl: 122px; --split-yr: 212px` |

**Desktop** (`≥821px`, a 290px-tall banner across the full content width):
- `--u: 1px`.

| Piece | Position |
|---|---|
| Boss figure | `top: 0; right: 7%; width: 210px` |
| Boss platform | `right: calc(7% + 4px); top: 186px; width: 206px` |
| Boss block | `top: 30px; right: calc(7% + 236px); width: 280px` |
| Hero figure | `left: calc(7% + (var(--hero-x) - 23) * 1px); bottom: calc(var(--hero-y) * 1px); width: calc(var(--hero-w) * 1px)` |
| Hero platform | `left: calc(7% - 19px); bottom: 4px; width: 152px` |
| Hero block | `bottom: 18px; left: calc(7% + 200px); width: 250px` |
| Split | `--split-x: calc(93% - 516px); --split-yl: 0px; --split-yr: 212px` |

**Clip paths.** The same two formulas work on both layouts:
- Boss: `polygon(0 0, 100% 0, 100% var(--split-yr), var(--split-x) var(--split-yr), var(--split-x) var(--split-yl), 0 var(--split-yl))`
- Hero: `polygon(0 var(--split-yl), var(--split-x) var(--split-yl), var(--split-x) var(--split-yr), 100% var(--split-yr), 100% 100%, 0 100%)`

**Per-hero placement.** `--hero-w`, `--hero-x` and `--hero-y` are unitless numbers, set inline from `HERO_PLACEMENT` (Task 5):

| Hero | `--hero-w` | `--hero-x` | `--hero-y` | Mirrored |
|---|---|---|---|---|
| Warrior | 160 | 23 | 8 | yes |
| Cleric | 174 | 6 | 6 | yes |
| Ranger | 160 | 12 | 10 | no |

## Review Focus

1. **A 16-character hero name and an 18-character boss name** ("Ethereal Sovereign"). The hero name is cut with "…" while the level and chevron stay visible. The boss name wraps and the chevron follows it. → Task 5 structure test, plus a Task 9 screenshot.
2. **A boss with reflect, lifesteal and wounds.** Its chips wrap to two lines, and the boss block must still sit wholly inside the boss tap area (above `--split-yl`). → Task 9 `elementFromPoint` check.
3. **Phones at 360px and 320px.** Sprites shrink, no block text sits on the art, and both tap areas still work. → Task 9 screenshots.
4. **A press that turns into a scroll.** `pointercancel` must clear the press glow, so it never sticks. → Task 6 test.
5. **Desktop scrolling.** The drop-down bar drops in once the banner has scrolled away, and only then. → Task 9 check at 1280px.

---

### Task 1: Hooded ranger art

**Files:**
- Modify: `public/sprites/player/ranger.png` (replace)
- Modify: `CREDITS.md:126`

- [ ] **Step 1: Replace the art.** `cp docs/mockups/sprites/ranger-hood.png public/sprites/player/ranger.png`
- [ ] **Step 2: Verify the size.** Run `sips -g pixelWidth -g pixelHeight public/sprites/player/ranger.png`. Expected: 184 × 184.
- [ ] **Step 3: Update the credits row.** Point the `player/ranger.png` row's source to `starter-hero-ranger-bow-cloak-nature-hurt-taking-damage_20260217_212747.png`.
- [ ] **Step 4: Check that nothing breaks.** Run `npm run test:unit`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Use the hooded ranger art"`

### Task 2: The drop-down bar becomes plain status at every width

**Files:**
- Create: `src/components/boss/bossSprites.ts`
- Create: `src/components/character/heroArt.ts`
- Modify: `src/components/boss/BossBar.vue`
- Modify: `src/components/boss/BossBar.spec.ts`
- Modify: `src/components/boss/BossPanel.vue` (drop `@open`; import `PERSONALITY_SPRITE`)

**Interfaces:**
- Produces:
  - `PERSONALITY_SPRITE: Record<Personality, string>`, moved verbatim with its comment from `BossPanel.vue`.
  - `DRAWN_FACING_LEFT: Record<HeroClass, boolean>`, moved from `BossBar.vue`.
  - `interface HeroPlacement { width: number; left: number; bottom: number }`
  - `HERO_PLACEMENT: Record<HeroClass, HeroPlacement>`, with the values from the per-hero table.
- BossBar's props are unchanged. Its `open` emit is removed.

- [ ] **Step 1: Write the failing test.** Replace `'asks for the boss details when tapped'` with:

```ts
it('is plain status, not a button', async () => {
  const wrapper = mount(BossBar, { props: { ...props, shown: true } });
  expect(wrapper.element.tagName).toBe('DIV');
  await wrapper.trigger('click');
  expect(wrapper.emitted('open')).toBeUndefined();
});
```

- [ ] **Step 2: Run it and watch it fail.** `npx vitest run src/components/boss/BossBar.spec.ts`. Expected: FAIL (tagName `BUTTON`).
- [ ] **Step 3: Implement.**
  - In `BossBar.vue`, the root becomes `<div class="boss-bar">`. Keep `inert`, and drop `@click`, `defineEmits` and the button-reset declarations.
  - Delete the `@media (min-width: 821px) { .boss-bar { display: none } }` block.
  - At 821px and up, cap the content to the app column: `padding-inline: max(1rem, calc((100vw - 1216px) / 2))`. 1216px is `#app`'s 1280px max-width minus its 2rem padding on each side.
  - Update the header comment: the bar now shows at every width once the stage has gone, and it is not tappable.
  - Create the two modules and switch `BossBar.vue` and `BossPanel.vue` to import from them.
- [ ] **Step 4: Run the tests.** `npm run test:unit && npx vue-tsc -b`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Make the drop-down bar plain status at every width"`

### Task 3: FightStage wraps both panels and owns the bar

**Files:**
- Create: `src/components/fight/FightStage.vue`
- Create: `src/components/fight/FightStage.spec.ts`
- Modify: `src/components/boss/BossPanel.vue` (remove the `BossBar` Teleport, `useScrolledPast`, `bar`/`panel` refs and `heroLevel`)
- Modify: `src/components/layout/AppShell.vue` (render `<FightStage />` where `<BossPanel /><CharacterPanel />` were)

**Interfaces:**
- Consumes: `PERSONALITY_SPRITE`, `useCelebration()` (`phase`, `displayedBoss`, `heldLevel`), `useScrolledPast(el, cover)`, `heroClassFor`, `effectiveStat`.
- Produces:
  - `<FightStage />`, which takes no props.
  - Its markup: `<section ref="stage" class="fight-stage"><div class="stage-bg" aria-hidden="true" /><div class="stage-inner"><BossPanel /><CharacterPanel /></div><Teleport to="body"><BossBar … /></Teleport></section>`.
  - `.stage-inner` is where Task 4 onward puts the geometry custom properties.

- [ ] **Step 1: Write the failing tests** in `FightStage.spec.ts`:
  - Use `setActivePinia(createPinia())` in `beforeEach`.
  - Mount with `global: { stubs: { teleport: true } }`.

```ts
it('holds the boss and the hero on one stage', () => {
  const wrapper = mount(FightStage);
  expect(wrapper.find('.stage-inner .boss-panel').exists()).toBe(true);
  expect(wrapper.find('.stage-inner .character-panel').exists()).toBe(true);
});

it('feeds the drop-down bar the boss and the hero, parked until the stage scrolls away', () => {
  const wrapper = mount(FightStage);
  const bar = wrapper.findComponent(BossBar);
  const boss = useBossStore().boss;
  expect(bar.props('name')).toBe(PERSONALITY_NAME[boss.personality]);
  expect(bar.props('heroLevel')).toBe(useCharacterStore().character.level);
  expect(bar.props('shown')).toBe(false);
});
```

- [ ] **Step 2: Run them and watch them fail.** `npx vitest run src/components/fight`. Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement `FightStage.vue`.**
  - Move the bar wiring here from `BossPanel.vue`: `boss`, `hero`, `heroLevel`, `bar` ref, and `useScrolledPast(stage, …)` on the stage element.
  - Keep the comment explaining the bar, now saying it is triggered by the whole stage.
  - In `AppShell.vue`, swap in `<FightStage />`. The side column stays for now, and Task 7 replaces it.
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 5: Commit.** `git commit -m "Add FightStage around the boss and hero panels"`

### Task 4: The boss half on the stage

**Files:**
- Modify: `src/components/boss/BossPanel.vue`
- Modify: `src/components/fight/FightStage.vue` (stage box, `.stage-inner` geometry variables, phone full-bleed)
- Create: `src/components/boss/BossPanel.spec.ts`

**Interfaces:**
- Consumes: the Stage geometry section and the boss clip path.
- Produces:
  - Root `<div class="boss-panel">` with `display: contents`. It no longer has the `panel` class, so it gets no frame or diamond.
  - Children:
    - `.boss-plat`
    - `.boss-figure` (classes `hit`, `dying`, `arriving`). It contains the `Sprite`, death flash and sparks, and the `.hit-layer` popups.
    - `.boss-block`, holding `h2.boss-name`, `HealthBar` (label hidden), `span.hp-numbers` right-aligned under the bar, then `p.stat-summary` (wraps freely).
    - `.slain-stamp`, which spans the stage width and is vertically centred on the boss figure.
    - `<button type="button" class="tap tap-boss" aria-label="Boss details">`
    - The existing `Modal`, unchanged.
- `FightStage` gains:
  - `.fight-stage`: on phone it's full-bleed (`width: 100vw; margin-inline: calc(50% - 50vw)`), so the fog runs edge to edge.
  - `.stage-bg` is absolutely positioned and fills the stage.
  - `.stage-inner` is `position: relative`, with the phone and desktop variables from the geometry section.

- [ ] **Step 1: Write the failing tests** in `BossPanel.spec.ts`:
  - Use pinia in `beforeEach`.
  - Use `vi.useFakeTimers()` with `useCelebration().clear()` and `vi.useRealTimers()` in `afterEach`.

```ts
it('opens the boss details from its tap area', async () => {
  const wrapper = mount(BossPanel);
  await wrapper.find('button.tap-boss').trigger('click');
  expect(wrapper.findComponent(Modal).props('modelValue')).toBe(true);
});

it('shows the HP numbers under the HP bar', () => {
  const store = useBossStore();
  store.boss = { ...store.boss, health: 474.2, maxHealth: 620 };
  const wrapper = mount(BossPanel);
  const block = wrapper.find('.boss-block').element;
  const kids = Array.from(block.children);
  const numbers = block.querySelector('.hp-numbers')!;
  expect(numbers.textContent).toBe('474 / 620');
  expect(kids.indexOf(numbers)).toBe(kids.indexOf(block.querySelector('.health-bar')!) + 1);
});

it('lets the boss fall and stamps "Slain" on the stage', async () => {
  const rng = createRng(7);
  const wrapper = mount(BossPanel);
  useCelebration().celebrateBossKill({ ...generateBoss(1, rng), health: 0 }, generateBoss(2, rng));
  vi.runOnlyPendingTimers();
  await nextTick();
  expect(wrapper.find('.boss-figure').classes()).toContain('dying');
  expect(wrapper.find('.slain-stamp').exists()).toBe(true);
});
```

- [ ] **Step 2: Run them and watch them fail.** `npx vitest run src/components/boss/BossPanel.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Rebuild the template as described in Produces. The `.summary-row` button, `.stage-wrap` and `.summary-info` go away.
  - Move the boss's existing hit, kill and arrival animations onto `.boss-figure :deep(.sprite)`, and keep the reduced-motion block.
  - `.tap` gets `position: absolute; inset: 0; z-index: 6; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent;` plus the boss clip path.
  - Minimalist dressing:
    - The platform is a faint ellipse in `color-mix(in srgb, var(--text) 12%, transparent)`.
    - Block text gets a dark `text-shadow` so it stays legible over art.
    - The sprite keeps today's damage-colour rim.
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 5: Commit.** `git commit -m "Put the boss on the fight stage"`

### Task 5: The hero half on the stage, without the item grid

**Files:**
- Modify: `src/components/character/CharacterPanel.vue`
- Create: `src/components/character/CharacterPanel.spec.ts`

**Interfaces:**
- Consumes: `HERO_PLACEMENT`, `DRAWN_FACING_LEFT` (Task 2), `heroClassFor`, and the hero clip path.
- Produces:
  - Root `<div class="character-panel" :class="{ leveling }">` with `display: contents`.
  - Children:
    - `.hero-plat`
    - `.hero-figure`. It has class `mirrored` (`scale: -1 1` on the img) when `DRAWN_FACING_LEFT[heroClass]`, and an inline style `{ '--hero-w': w, '--hero-x': x, '--hero-y': y }`. It contains `PlayerSprite` (sized to the figure's width through `:deep`), the hero's `.damage-popup`s and `.level-ring`.
    - `.hero-block`, holding:
      - `h2.name-line`: `span.hero-name` (nowrap, ellipsis, `min-width: 0`), then `span.level-number` (`flex-shrink: 0`), then the `Level up` popup.
      - `HealthBar` (label hidden), then `span.hp-numbers`, then `ExpBar` (label hidden), then `p.stat-summary`.
    - `<button type="button" class="tap tap-hero" :aria-label="`${heroName} details`">`
    - The existing `Modal`, unchanged.

- [ ] **Step 1: Write the failing tests** in `CharacterPanel.spec.ts`:
  - Use pinia in `beforeEach`.
  - Add a helper `setClass(physical, magic)` that writes `character.starterStats.physicalDamage` and `.magicDamage`.

```ts
it('has no equipped-items grid, but keeps the gear in the details', async () => {
  const store = useCharacterStore();
  const item = ITEM_CATALOG[0];
  store.character.ownedItemIds = [item.id];
  store.character.equippedItemIds = [item.id];
  const wrapper = mount(CharacterPanel);
  expect(wrapper.find('.item-grid').exists()).toBe(false);
  await wrapper.find('button.tap-hero').trigger('click');
  expect(wrapper.findComponent(Modal).props('modelValue')).toBe(true);
});

it('keeps the level outside the part of the name that gets cut', () => {
  useCharacterStore().character.name = 'Bartholomew Long';
  const wrapper = mount(CharacterPanel);
  expect(wrapper.find('.name-line .hero-name').text()).toBe('Bartholomew Long');
  expect(wrapper.find('.name-line > .level-number').text()).toBe(String(useCharacterStore().character.level));
});

it('shows the HP numbers under the HP bar', () => {
  const store = useCharacterStore();
  store.character.currentHealth = 980.4;
  const wrapper = mount(CharacterPanel);
  const block = wrapper.find('.hero-block').element;
  const kids = Array.from(block.children);
  const numbers = block.querySelector('.hp-numbers')!;
  expect(numbers.textContent).toBe(`980 / ${Math.round(effectiveStat(store.character, 'health'))}`);
  expect(kids.indexOf(numbers)).toBe(kids.indexOf(block.querySelector('.health-bar')!) + 1);
});

it('turns the warrior and cleric to face the boss and places each by its class', async () => {
  setClass(600, 300);
  const wrapper = mount(CharacterPanel);
  expect(wrapper.find('.hero-figure').classes()).toContain('mirrored');
  setClass(300, 600);
  await nextTick();
  expect(wrapper.find('.hero-figure').attributes('style')).toContain('--hero-w: 174');
  setClass(450, 450);
  await nextTick();
  expect(wrapper.find('.hero-figure').classes()).not.toContain('mirrored');
});
```

  Because Modal teleports, the gear list itself is checked in Task 9. This test only pins that the modal opens.

- [ ] **Step 2: Run them and watch them fail.** `npx vitest run src/components/character`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Delete the item grid and its support:
    - `gridCols`, `pinnedSlot`, `togglePin` and `unpinOnOutsideTap`, plus their document listeners.
    - All `.item-grid`, `.item-slot`, `.item-art`, `.item-icon` and `.item-tooltip` CSS.
  - Keep `slotCount`, `equippedSlots`, `equippedItems`, `emptySlotCount` and the `.rarity-*` classes, which the modal uses.
  - Drop the `.exp-numbers` span from the stat line.
  - Make `clipStatLine` unconditional: remove the `PHONE` media query and its listeners, so the hero's stats stay on one line at every width. Update its comment.
  - Delete the old `@media (max-width: 820px)` strip block.
  - Move the hit shake onto `.hero-figure :deep(.player-sprite)`.
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 5: Commit.** `git commit -m "Put the hero on the fight stage and drop the item grid"`

### Task 6: Press feedback and the chevron cue

**Files:**
- Create: `src/composables/usePress.ts`
- Create: `src/composables/usePress.spec.ts`
- Modify: `src/components/boss/BossPanel.vue`
- Modify: `src/components/character/CharacterPanel.vue`
- Modify: both halves' specs

**Interfaces:**
- Produces: `usePress(): { pressed: Ref<boolean>; pressHandlers: { pointerdown: () => void; pointerup: () => void; pointercancel: () => void; pointerleave: () => void } }`. It binds with `v-on="pressHandlers"` on each `.tap`, and each half's root gets `:class="{ pressed }"`.

- [ ] **Step 1: Write the failing tests.**

```ts
// usePress.spec.ts
it('presses on pointerdown and lets go on pointerup', () => {
  const { pressed, pressHandlers } = usePress();
  pressHandlers.pointerdown();
  expect(pressed.value).toBe(true);
  pressHandlers.pointerup();
  expect(pressed.value).toBe(false);
});

it('lets go when the press turns into a scroll or slides off', () => {
  const { pressed, pressHandlers } = usePress();
  pressHandlers.pointerdown();
  pressHandlers.pointercancel();
  expect(pressed.value).toBe(false);
  pressHandlers.pointerdown();
  pressHandlers.pointerleave();
  expect(pressed.value).toBe(false);
});

// BossPanel.spec.ts (and the same on CharacterPanel with .tap-hero / .character-panel)
it('lights the boss while its tap area is held', async () => {
  const wrapper = mount(BossPanel);
  await wrapper.find('.tap-boss').trigger('pointerdown');
  expect(wrapper.find('.boss-panel').classes()).toContain('pressed');
  await wrapper.find('.tap-boss').trigger('pointerup');
  expect(wrapper.find('.boss-panel').classes()).not.toContain('pressed');
});
```

- [ ] **Step 2: Run them and watch them fail.** `npx vitest run src/composables/usePress.spec.ts src/components/boss src/components/character`. Expected: FAIL.
- [ ] **Step 3: Implement** `usePress` and wire it into both halves.
  - **Minimalist pressed look:**
    - The sprite's filter chain gets `brightness(1.25)` appended.
    - The platform turns `color-mix(in srgb, var(--accent) 30%, transparent)`.
    - The name turns `var(--accent)`.
    - The look appears instantly (`transition-duration: 0s` while `.pressed`) and fades out over 0.3s.
    - Under reduced motion it has no transition.
  - **Keyboard focus** shows the same look: `.boss-panel:has(.tap:focus-visible)` gets the same rules as `.pressed`, and likewise for the hero.
  - **The chevron** is an `::after` on `h2.boss-name` and on `h2.name-line`, after the level:

```css
content: ''; display: inline-block; width: 6px; height: 6px; margin-left: 9px; vertical-align: 1px;
border-top: 1.5px solid currentColor; border-right: 1.5px solid currentColor; transform: rotate(45deg);
```

    In Minimalist it takes `color: var(--text)`. Boss names wrap normally, so the chevron follows the last word.
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 5: Commit.** `git commit -m "Add the press glow and the chevron tap cue"`

### Task 7: Desktop banner and the page layout

**Files:**
- Modify: `src/components/layout/AppShell.vue`
- Create: `src/components/layout/AppShell.spec.ts`
- Modify: `src/components/fight/FightStage.vue`, `BossPanel.vue` and `CharacterPanel.vue` (`@media (min-width: 821px)` geometry)

**Interfaces:**
- `.layout` becomes `<FightStage /><div class="main"><ProgressSummary class="progress" /><HabitList /></div><aside class="side"><QuestSection /><ActivityLog /></aside>`.

- [ ] **Step 1: Write the failing test.**
  - `AppShell.spec.ts` uses `shallowMount` with pinia, after `useCharacterStore().character.name = 'Ash'`.

```ts
it('puts the stage on top, skills on the left, quests and the log on the right', () => {
  const wrapper = shallowMount(AppShell);
  const layout = wrapper.find('.layout');
  expect(layout.element.firstElementChild!.tagName.toLowerCase()).toBe('fight-stage-stub');
  expect(layout.find('.main progress-summary-stub').exists()).toBe(true);
  expect(layout.find('.main habit-list-stub').exists()).toBe(true);
  expect(layout.find('.side quest-section-stub').exists()).toBe(true);
  expect(layout.find('.side activity-log-stub').exists()).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail.** `npx vitest run src/components/layout/AppShell.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Desktop and tablet** (`≥821px`):
    - `.layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 1.25rem; align-items: start; }`
    - `FightStage` spans `1 / -1`.
    - At `max-width: 1024px` the right column is 320px.
    - `.main` and `.side` are flex columns with a 1.25rem gap. Nothing is sticky any more.
  - **Phone** (`≤820px`):
    - A single column, with `.main` and `.side` set to `display: contents`.
    - `.progress { display: none }` hides the progress rings on phone.
  - **Banner geometry:** add the desktop values from the geometry section to the three stage components.
- [ ] **Step 4: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 5: Commit.** `git commit -m "Lay out the fight as a wide banner on desktop"`

### Task 8: Ashen dressing

**Files:**
- Modify: `src/assets/scss/themes/ashen.scss`

Source values come from `docs/mockups/fight-header-crop.html` (selectors `.bg`, `.plat`, `.who img`, `.fight .who.hero img`, `.nm`, `.num`, `.bar`, `.exp`, `.float`) and from `fight-tap-cue.html`, option 1 (press styles).

- [ ] **Step 1: Remove what's obsolete.**
  - The `.boss-panel .sprite-wrapper` fog and embers.
  - `.boss-panel .summary-info h2`.
  - The item-slot and item-tooltip rules.
  - From the phone block: `.layout section.character-panel::after` and every `.character-panel .exp-bar…` and `.stat-summary` strip rule.
  - Keep every `.boss-bar` rule, and the boss details' `.hero-sprite` stage.
- [ ] **Step 2: Add the stage look.**
  - **Background.** `.fight-stage .stage-bg` gets the `embers` mixin, the mock's two fog radial gradients and the top/bottom fade mask (`linear-gradient(180deg, transparent, #000 14%, #000 78%, transparent)`).
  - **Ground fog.** Use a soft radial gradient with no `filter: blur`. It drifts with the existing `ashen-fog` keyframes, which animate `transform` and `opacity` only.
  - **Platforms.** Use the mock's `.plat` gradient and top hairline.
  - **Sprites.**
    - The boss sprite keeps today's rim-and-ember filter chain.
    - The hero sprite gets `drop-shadow(0 0 18px rgba(0,0,0,.95)) brightness(.8) contrast(1.05)`.
  - **Names.**
    - The boss name is engraved at `0.8rem`, `0.16em`.
    - The hero name is engraved at `0.75rem`, `0.16em`.
    - The level and the chevron are `var(--accent-solid)`.
    - Names get `text-shadow: 0 0 12px rgba(0,0,0,.9)`.
  - **Numbers.** `.hp-numbers` are engraved `$caps-xs` at `0.12em`, in `var(--text)`.
  - **Bars.**
    - Inside the stage, `.health-bar` and `.exp-bar` have no margins.
    - The boss HP bar is 11px, the hero HP bar 6px and the EXP bar 3px.
  - **Stat lines.** They get `text-shadow: 0 0 8px #000, 0 1px 2px #000`.
  - **Pressed and focused.**
    - The boss chain gets `brightness(1.4)` appended, and the hero chain becomes `brightness(1.15) contrast(1.05)`.
    - The platform becomes `radial-gradient(ellipse at center, rgba(230,199,127,.42), rgba(200,169,110,.12) 60%, transparent 72%)` with `border-top-color: rgba(230,199,127,.75)`.
    - The name becomes `var(--accent)`.
  - **Reduced motion.** Add the stage fog to the existing reduced-motion block.
- [ ] **Step 3: Run the full checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there.
- [ ] **Step 4: Commit.** `git commit -m "Dress the fight stage in Ashen"`

### Task 9: Check it in the running app

There's no code in this task unless a check fails; a fix goes back to the task that owns it. Run `npm run dev`, drive it with `playwright-cli`, and save screenshots to the session scratchpad.

- [ ] **Step 1: Phone at 390px, Ashen.** Compare against `fight-header-crop.html` for all three heroes. Swap `starterStats` from the console, or start new runs. Ignore the mock-only hit effects; see the spec's Follow-up section.
- [ ] **Step 2: Long names.** Set the hero name to `Bartholomew Long`, and a boss to the `Ethereal Sovereign` personality. Expected: the hero name is cut with "…" with the level and chevron visible, and the boss name wraps onto two lines.
- [ ] **Step 3: A boss with reflect, lifesteal and wounds.** Expected: `document.elementFromPoint` at the centre of the last boss chip returns `.tap-boss`, and at the centre of the hero's stat line it returns `.tap-hero`.
- [ ] **Step 4: Phone widths.** Check 360px, 375px and 320px. Expected: no block text sits on sprite art, and both tap areas open their modals. At 600px, the stage is centred at 430px and the fog runs edge to edge.
- [ ] **Step 5: Desktop.** Check 1280px and 1024px against `fight-desktop.html` option 3, and also check 821px. Expected:
  - The bar drops in only once the banner has scrolled away.
  - Skills are on the left, and quests and the log are on the right.
  - The progress rings sit above skills.
  - At 820px and below the progress rings are gone.
- [ ] **Step 6: The full fight, on phone and desktop.** In dev, the "Preview boss kill (testing)" button in `PopupPreview` replays a kill and then a level-up without changing the stores.
  - A kill: the boss falls, "Slain" is stamped across the stage, and the next boss arrives.
  - A level-up: the ring, the "Level up" text, and the level held until the beat.
  - A hit on the hero: the popup plus the flinch.
  - Tapping opens each modal, and the hero modal's Equipment list shows gear and empty slots.
  - The press glow appears, and a press that turns into a scroll doesn't leave it stuck.
- [ ] **Step 7: Minimalist.** Switch theme and repeat Steps 1 and 5 at a glance. Expected: same layout, plainer, chevron visible.
- [ ] **Step 8: Final checks.** `npm run test:unit && npx vue-tsc -b`, then `npm run lint`. Expected: tests and types pass, and lint shows only the 3 errors that were already there. Report the test count.
