# Fight stage — Design Spec

Status as of 2026-10-25. Replaces the separate boss and hero panels with one frameless fight stage: boss top-right, hero bottom-left, facing each other across the fog. On phones it sits at the top of the page. On desktop and tablet it becomes a wide banner across the page. The drop-down bar (option D, already built and uncommitted) takes over once the stage scrolls away.

Mockups:
- Phone stage: `docs/mockups/fight-header-crop.html`. Its default toggles are the picked settings: Stats **Both**, Frame **None**, Hero **Facing boss**.
- Tap cue: `docs/mockups/fight-tap-cue.html`, option **1** (chevron by name).
- Desktop and tablet: `docs/mockups/fight-desktop.html`, option **3** (wide banner).
- Drop-down bar: `docs/mockups/fight-dock.html`, option **D** (built).

## Why

The fight is the heart of the app, but today it's two stacked cards: a boss panel and a hero panel. The new stage reads as one scene, with the two fighters squaring off. Hits land on screen where you can see them, while your skills list stays in view under the stage. The end goal is a phone app (see CLAUDE.md), so the phone layout leads and desktop follows.

## Goals

- **One scene.** Boss and hero share one stage with no box around it. Names, bars, numbers and stats float on the fog next to each fighter.
- **Obviously tappable.** Tapping the boss opens the boss modal, and tapping the hero opens the hero modal. These modals matter: the hero modal is now the only place to see your gear. The cue has to be visible without hover and without words.
- **Same hits as today.** Damage popups, hit flinches, the kill celebration (dying, slain stamp, next boss arriving), the level-up beat and the held level all keep working on the new stage. The mocks also play new hit effects, which are a separate follow-up (see **Follow-up: hit effects**).
- **Phone-sized first.** Safe areas, tap targets of 44px or more, nothing behind hover, and cheap enough for a mid-range Android WebView.

## Non-goals

- No equipped-items grid anywhere, desktop included. Gear lives only in the hero modal's Equipment list.
- No gear drawn on the hero sprite.
- No change to combat math, the stores or the save format.
- No new boss art. The only new art is the hooded ranger.
- No new hit effects. The ones the mocks play are a follow-up (see **Follow-up: hit effects**). When checking this build against the mocks, ignore them.

## Anti-goals

- Hint text such as "Tap to view". Player-facing copy stays terse (see the terse-UI rule).
- A drop-down bar that opens modals. It is status only.
- A layout that differs between themes. Minimalist and Ashen share one layout; only the dressing differs.
- Anything that ties the app to a desktop browser or breaks a Capacitor WebView.

## Confirmed decisions

### The stage (phone, under 820px)

- **Frameless.** There's no box around the stage. In Ashen it's fog and embers that fade into the page at the top and bottom, as in the mock.
- **Diagonal.**
  - The boss sprite sits top-right. Its block floats top-left: name, thick HP bar, HP numbers under the bar, then the stat chips.
  - The hero sprite sits bottom-left, standing on a platform and drawn smaller than the boss. Its block floats bottom-right: name and level, HP numbers, thin HP bar, EXP bar, then the stat chips.
- **Hero stats on one line.** Chips that don't fit are hidden whole. `CharacterPanel.vue`'s `clipStatLine` already does this on phones, so reuse it.
- **Whole hero shown.** No cropping.
- **Facing the boss.** The warrior and cleric art faces left, so it is mirrored. The ranger art faces right, so it isn't. `BossBar.vue` already does the same mirroring.
- **Hero size and placement.** All heroes draw at 0.87x the width of their 2x art file, so their art pixels match. Each is placed by its visual center of mass, not its box. These are the mock's tuned values on a 390px-wide, 300px-tall stage:

  | Hero | Drawn width | Left | Bottom | Mirrored |
  |---|---|---|---|---|
  | Warrior | 160px | 23px | 8px | yes |
  | Cleric | 174px | 6px | 6px | yes |
  | Ranger (hooded) | 160px | 12px | 10px | no |

  The boss draws 190px wide, 10px from the right edge, at the top. The other positions are in the mock's markup.
- **New ranger art.** Replace `public/sprites/player/ranger.png` with the hooded FreePixel frame, already processed as `docs/mockups/sprites/ranger-hood.png`. Add its line to CREDITS.md. The raw source is `starter-hero-ranger-bow-cloak-nature-hurt-taking-damage_20260217_212747.png` in the gitignored `assets/` folder. It was shrunk from 200px to 184px (LANCZOS), then given the usual 2x2 average and 48 colours.

### Tapping

- **Two big tap areas.** Each half of the stage is one button: the boss half covers the boss sprite, name, bar, numbers and stats, and the hero half covers the same for the hero. The halves meet in a step that follows the diagonal, with no gap and no overlap. `fight-tap-cue.html` shows the split; turn on "Tap areas: Shown" to see it.
- **Chevron cue.** A small gold chevron sits after the boss's name and after the hero's name and level. Minimalist gets a plain chevron in its own colours.
- **Press feedback.** On press, the figure brightens, its platform glows gold and the name turns gold. It appears instantly and fades out over about 0.3s, so even a quick tap shows it. Minimalist gets a plainer equivalent.
- **The modals themselves don't change.** The boss modal and hero modal keep their current content. The hero modal's Equipment list stays.

### The drop-down bar

- **Not tappable.** `BossBar.vue` stops being a `<button>` and drops its `open` event and press styling. It becomes plain status. Its tests change to match.
- **Triggered by the stage.** The bar drops in once the whole stage has scrolled away, using `useScrolledPast` on the stage element. That also removes the brief double HP display: the hero's HP is never in the bar and on the stage at the same time.
- **Shown on desktop and tablet too.** Today it's hidden at 821px and up. With the wide banner it should drop in at every width.

### Desktop and tablet (820px and wider)

- **Wide banner.** The stage spans the content width in place of today's 280px side column. It uses the same diagonal stretched wide:
  - The boss sprite sits near the right edge (210px in the mock), with its block floating to the left of it near the top.
  - The hero sits near the left edge (160px), with its block floating to the right of it near the bottom.
  - The mock positions them as percentages of the width (7% in from each edge), so the layout holds from 1280px down to 820px. Its stage is 290px tall.
- **Below the banner, two columns.** Skills go on the left. Quests and the log go in a right column, 360px wide in the mock (320px at 1024px).
- **The banner isn't sticky.** It scrolls away as on phone, and the drop-down bar takes over.
- Desktop matters less than phone. It should look right, but phone polish comes first.

### Themes

- **Ashen** gets the mock's full look: fog, embers, ground fog, platforms, backlit hero, engraved caps, gold chevron and gold press glow.
- **Minimalist** (the unthemed base styles) gets the same layout, plainer: no fog or embers, simple or no platforms, its own colours. This follows the pattern the drop-down bar already uses.

## Calls made in writing this spec (check these)

- **ProgressSummary** (daily/weekly/best-streak rings) is desktop and tablet only (user's call). It's hidden entirely on phone, under 820px. On desktop and tablet it goes at the top of the left column, above skills.
- **Boss stat chips may wrap** to a second line when the boss has reflect, lifesteal or wounds. The one-line rule applies only to the hero.
- **Damage popups** keep today's style: the boss's pop over the boss sprite, and the hero's rise off the hero sprite.
- **The level-up ring and "Level up" text** stay on the hero, as today.
- **Long names.**
  - Hero names can be 16 characters (`MAX_HERO_NAME_LENGTH`), and the hero block is narrow. So the hero's HP numbers move under its HP bar, right-aligned, as the boss block already does. The name row then holds only the name, level and chevron. If the name still doesn't fit, it's cut off with "…", and the level and chevron always stay visible.
  - Boss names, which run up to 18 characters ("Ethereal Sovereign"), are never cut. They wrap to a second line instead, with the chevron after the last word.
- **Phone widths other than 390px.** The stage is designed at 390px.
  - Wider screens in the phone layout (up to 819px, such as tablets held upright) centre the stage at about 430px, with the fog running the full width.
  - Narrower phones (360px and 375px) shrink the sprites in proportion so the blocks don't cover the art. Text stays the same size.
  - 320px only has to stay legible and tappable.

## Left to the builder

- **Component structure.** For example, a new `FightStage.vue` that composes boss and hero halves and owns both modals, or keeping `BossPanel` and `CharacterPanel` as the two halves inside a stage wrapper. Remove the item-grid code and its pin/tooltip handling from `CharacterPanel.vue` either way.
- **Exact tap-area geometry** at each width, as long as each half covers its whole figure and block, and the halves meet with no gap.
- **The bar's width on desktop.** Full viewport or the content width, whichever looks right.
- **Accessibility details.** Real focusable buttons with labels and a visible focus style, and reduced-motion handling for the press glow and hits, following the existing patterns.
- **Performance.** The mock's ground fog uses `filter: blur(5px)`. Swap it for a pre-blurred gradient if it costs too much on Android.

## Follow-up: hit effects (not in this build)

The user wants these, but as their own build once the stage is done. All three stage mocks play them; the values below come from `docs/mockups/fight-header-crop.html`.

- **Attacker lunges.**
  - The attacker darts toward its target and back over 0.32s, with a slight scale-up (1.04) at the peak.
  - The hero lunges up and right (14px, −12px), and the boss lunges down and left (−12px, 12px).
  - The hit lands on the target 130ms after the lunge starts.
- **Slash streak.**
  - A thin streak (3px, about 120% of the target's width, angled at −28°) wipes across the target from left to right in 0.35s, then fades.
  - It's in the hit's damage-type colour with a white core and a glow, and red (#c33a2e) when the boss hits the hero.
- **Flash and shake.** The hit fighter flashes white (brightness 3, no colour), then shakes −5px, +4px, −2px as it fades back over 0.4s.
- **Coloured popups.**
  - Damage numbers take their damage type's colour.
  - Crits draw bigger (32px instead of 24px) with a "!" after the number.
  - Popups pop in at 0.6x scale, overshoot to 1.15x, then rise about 40px and fade over 1s.
- **Heal popups.** Heals pop a green "+N" over the hero. Today's `useDamagePopup` only fires when HP drops.
- **HP bar trail.**
  - On a hit, the red fill drops at once (0.15s) and a pale trail (rgba(240,222,190,.75)) catches up after a 0.45s pause, over 0.55s.
  - On a heal, the bar just grows.

**Pieces it touches.**
- `useDamagePopup`, which needs heal events, damage types and crits.
- `HealthBar`, for the trail.
- Both are shared with the drop-down bar and both modals, so the follow-up should decide where each effect shows: stage only, or the bar too.
- Reduced motion should drop the lunge, slash and shake but keep the popups, following the existing patterns.

## Constraints and context

- **Uncommitted work.** `BossBar.vue`, `BossPanel.vue`, `CharacterPanel.vue`, `ashen.scss` and `useCelebration.ts` hold another session's uncommitted kill-celebration work, with the drop-down bar layered on top. Build on top of that work; don't revert it.
- **Breakpoint.** 820px, matching `AppShell.vue` and `BossBar.vue`.
- **Ashen styling.** It all lives under `:root[data-theme='ashen']` in `src/assets/scss/themes/ashen.scss`. The base component styles are Minimalist.
- **Tests and checks.** Vitest specs sit beside each component and composable. Types, lint and the full suite must pass. Check it in the running app at phone width (390px) and at 1280px against the mocks.
