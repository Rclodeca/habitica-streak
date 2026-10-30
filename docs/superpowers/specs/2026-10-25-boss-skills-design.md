# Boss skills — Design Spec

Status as of 2026-10-25. From boss #15 on, some bosses carry skills that fire when you knock their HP past a breakpoint (75%, 50% or 25%). Markers on the boss bar show where a skill waits. Wounds and Reflect stop being random boss traits and become two of these skills. Two new relics interact with the system.

Not yet mocked up. Mock the bar markers and the new status chips in Ashen before building any UI (see **UI**).

## Why

Late bosses are bigger numbers plus a few rare passives (lifesteal, and once reflect and Wounds on 10% of bosses). Skills give late fights their own identity. The markers show *that* a skill is coming, not which one, so each one is a surprise. The player can still plan around the line itself, for example by crossing two at once with a big hit.

These skills are the first boss threat that comes from making progress rather than from missing a habit, so even a perfect player gets hit. That's intended. The hits that do damage can never kill you. They leave you exposed to the next miss.

## Goals

- Late-game bosses feel different from early ones, and the difference ramps in slowly from boss #15.
- Every skill is readable: you can see on the bar that one is coming (but not which), and once it fires you can tell what it did.
- A big hit is rewarded: crossing several breakpoints at once fires only one skill.
- Reuse existing systems wherever possible: day-based status effects, boss lifesteal, crit and resist math, the activity log, the stat icons.

## Non-goals

- Shields (physical/magic damage shields). Discussed and on hold.
- Rejected skills: Enrage, Thorns, Plunder, Exhaust.
- New hit effects or stage animations for skills. Skills use the existing hit popup, the log and status chips. Anything flashier is a follow-up.
- Changing boss stats, boss HP growth or the drop tables.
- Skills before boss #15.

## Anti-goals

- **A skill that kills you.** Every HP hit floors at 1 HP.
- **Anything that touches streaks.** No skill breaks, freezes or protects a streak (see the no-streak-protection rule).
- **Anything that seals or weakens a specific habit.** It would make a real-life task feel pointless that day.
- **Explaining mechanics in player-facing copy.** Player-facing names and log lines stay short and terse. Item effect text is the exception: it states plainly what the item does.
- Anything that ties the app to a desktop browser or breaks a Capacitor WebView.

## Confirmed decisions

### Wounds leaves the normal boss traits

- Stop rolling `woundsAbility` in `generateBoss`, and remove `WOUNDS_ABILITY_CHANCE`, `WOUNDS_HIT_CHANCE_*`, `WOUNDS_DURATION_DAYS_OPTIONS` and `WOUNDS_EFFECT_RATE_OPTIONS` from tuning.
- `missHabit` no longer rolls or applies Wounds.
- Old saves: ignore any `woundsAbility` stored on a boss. A Wounds effect already active on the character just runs out as it does today.
- Remove the Wounds chance row and chip from `BossPanel.vue`.

### Reflect leaves the normal boss traits

Added 2026-10-26. A permanent 5% reflect on a boss 20+ nearly killed a player who never missed a habit: the reflected amount is a share of the damage *dealt*, which grows with the boss's exponential health, while the hero's HP doesn't.
- Stop rolling `reflectPct` in `generateBoss`, and remove `BOSS_REFLECT_WEIGHTS` from tuning. `Boss.reflectPct` is gone; a leftover value on an old save is ignored.
- Reflect is a boss skill now: for 2 days it throws `REFLECT_PCT` (5%) of the damage the hero deals back at the hero. The hit that fires it isn't reflected, only the hits after. Null Mirror still blocks it.
- Older bosses lose their reflect, including one already in progress when the update lands.

### The skills

| Skill | Unlocks at boss # | What it does | Lives on |
|---|---|---|---|
| Wounds | 15 | Your healing skills heal half as much for 2 days | character |
| Bloodlust | 15 | For 2 days, each time the boss hits you it heals 3% of its own max HP | boss |
| Reflect | 15 | For 2 days, 5% of the damage you deal is thrown back at you | boss |
| Blind | 15 | You can't crit for 2 days. Guaranteed crits (First Blood, Starfall) still land | character |
| Sever | 15 | No lifesteal for 2 days. No item counters it; Bloodcrystal's crit heal isn't lifesteal and still lands (added 2026-10-29) | character |
| Mend | 15 | The boss heals 10% of its max HP, once | instant |
| 20% hit | 20 | The boss hits you for 20% of your current HP | instant |
| Doom | 20 | A countdown starts. In 3 days the boss hits you for 50% of your current HP, unless it dies first | boss |
| Sunder | 20 | Your armor and MR are halved for 2 days | character |
| Undying | 20 | The boss can't drop below 10% of its max HP until the next day | boss |
| 40% hit | 25 | The boss hits you for 40% of your current HP | instant |

The **HP hits** are the 20% hit, the 40% hit and Doom. They share these rules:
- They floor your HP at 1. The death check rounds HP (see `reviveWithFeatherIfEquipped`), so 0.4 HP would count as dead.
- They ignore your armor and MR.
- Dawnguard Helm doesn't apply to them. It only softens missed-habit hits.

### How many skills a boss gets

Rolled per boss from fixed bands by boss #, with no blending between bands:

| Boss # | No skill | 1 skill | 2 skills | 3 skills |
|---|---|---|---|---|
| 15–19 | 65% | 35% | — | — |
| 20–24 | 45% | 35% | 20% | — |
| 25–29 | 30% | 40% | 30% | — |
| 30+ | 25% | 30% | 35% | 10% |

### Where the skills sit

- **1 skill:** 50%
- **2 skills:** 75% and 25%
- **3 skills:** 75%, 50% and 25%

### Which skills

- Picked at random from the skills unlocked at that boss #.
- No repeats on one boss.
- At most one HP hit per boss.
- Undying can only take the 25% slot. From 75% or 50%, you'd almost never get the boss down to 10% in a day.
- Skills are rolled when the boss is created and stored on the boss, like the hidden physical/magic lean, so the markers can show from the start of the fight.
- Bosses from old saves have no stored skills. They simply have none, including a boss already in progress when the update lands.

### Firing

- A breakpoint is crossed when a hit takes the boss from above it to at or below it. Any damage to the boss counts:
  - a skill hit or crit
  - an Overdrive use
  - Torch of Wrath's heal-damage
  - the reward for an avoided bad habit at rollover
- **Each breakpoint fires once per boss.** Healing back above it never re-arms it. Bosses heal through lifesteal, Bloodlust or Mend.
- **One hit crossing several breakpoints fires only the first (highest) one.** The others are spent and lost, not saved for later.
- **No skill fires if the hit kills the boss.** Every crossed breakpoint is simply spent.
- **Echoing Blade:** overkill carried into a new boss spends any breakpoints it passes, without firing them.

### Timing and edge cases

These are calls made while writing the spec, not decisions the user made. They're flagged so they can be checked.

- **Doom lands after the day's outcomes.** The countdown is stored on the boss with its landing day: 3 days after it fired, so a Monday Doom lands Thursday. It lands at the first rollover on or after that day, once that rollover's missed and avoided habits have resolved. If the missed-skills popup is up, it lands when the player clicks OK (`useMissedSkillsGate.acknowledge()`). If nothing is queued, it lands at rollover. Resolving the misses and rewards first means two things: an avoided bad habit that day can still kill the boss and cancel Doom, and the hit shows in the hit popup rather than behind the missed-skills popup. If the app stays closed past the landing day, Doom lands once, at the next rollover.
- **Undying clamps the hit that triggers it.** If that hit leaves the boss between 0% and 10%, the boss is set to 10%. If the hit would have killed the boss, it dies and Undying never fires (the kill rule). A bigger hit still wins.
- **Effects on the hero outlast the boss.** Wounds, Blind, Sever and Sunder run their full days even if the boss dies, as Wounds does today. Effects on the boss (Bloodlust, Reflect, Undying, Doom) end with it.
- **Wounds refreshes.** If Wounds is still active (from an earlier boss), the new one replaces it with a fresh 2 days.
- **Names for the HP hits** in the log and modal: **Rend** for the 20% hit and **Ravage** for the 40% hit. They're placeholders that keep the copy terse.

### Scales of Fate and Omen Hourglass (new relics)

| Relic | Theme | Effect text | Base stats |
|---|---|---|---|
| Scales of Fate | Support | Boss skills have a 50% chance to fail. | +15% health, +10% EXP |
| Omen Hourglass | Tank | Rend, Ravage and Doom take half as much. | +30% health |

- Scales of Fate (first planned as Hushing Bell; renamed 2026-10-29 to match the art the user picked, effect id `scales-of-fate`) rolls once when a skill fires. On a fail, the breakpoint is spent and nothing happens except a log line.
- Omen Hourglass halves the HP hits only: the 20% hit becomes 10%, the 40% hit 20% and Doom 25%. It doesn't touch the other skills.
- They're side-quest relics like the others and follow whatever relic unlock rule is current when they're built. It's fine that they don't matter before boss #15 (relic rule: some relics won't apply to a run).
- Stats raised in the 2026-10-29 relic review (were +10% health/+5% EXP and +20% health/+100 armor): relics are offered from level 1 and an unequipped item is dropped, so the Scales earned early sits idle for ~15 bosses (the Hourglass ~20) and has to be worth wearing on its stats alone, like Null Mirror. The Hourglass is pure health so it doesn't mirror Null Mirror's health + MR, and its text names the three skills it halves (Reflect also hurts and isn't halved).
- Art: Scales of Fate from `alchemy-scale.png`, Omen Hourglass from `hourglass-golden-ornate-sand-flowing-magical_20260225_190653.png` (`npm run item-icon`, credited in CREDITS.md). Both joined the catalog 2026-10-29.

### Existing items

- **Resisted skills** (updated 2026-10-29): an item can stop a skill outright when it fires; the breakpoint is spent and the card and log say "<Skill> resisted". **Aegis of the Unbroken** (Immune to Wounds and Sunder, effect `unbroken`, was `wound-immune`) resists Wounds and Sunder. **Bloodbound Carapace** (Bosses can't heal) resists Bloodlust and Mend, and still blocks the boss's lifesteal and the heal of a Bloodlust that fired before it was equipped (`missHabit`). **Null Mirror** (Immune to Reflect and Blind) resists Reflect and Blind, and still blocks a Reflect that fired before it was equipped (`completeHabit`). Sever stays unblockable (Scales of Fate can still make it fail). The map lives in `RESISTED_BY` in `bossSkills.ts`.
- **Blind:** First Blood and Starfall still force crits, and anything that keys off a crit follows from those forced crits only. That covers Bloodcrystal's crit heal, Hunter's Eye and Voidcaller's 3× crits.
- **Sunder** halves the armor and MR from your items. That's the only player armor/MR source today.
- **Wounds** keeps its current reach: it only cuts healing *skills*. Lifesteal, level-up heals, Ember Heart, Soul Lantern and Bloodcrystal's crit heal are unaffected.
- **Phoenix Feather** never triggers from a skill, since skills can't kill.
- **Giantslayer and Headsman** read real boss HP, so they're unaffected. Note that the 75% and 25% breakpoints line up with their thresholds.

## UI

Mock these in Ashen first, quickly, and let the user pick before building. Minimalist comes after (see the mockup rules).

- **Bar markers.** Every unfired skill gets a marker at its breakpoint, on both the fight stage's boss HP bar (`FightStage.vue`) and the drop-down bar (`BossBar.vue`). **Markers are generic: they never show which skill waits there. The skill is a surprise until it fires.** A marker disappears when its breakpoint is spent. Markers are status only, not tap targets: tapping the boss still opens the boss modal. Mockup: `docs/mockups/boss-skill-markers.html`, option **B (Diamond)**: Ashen's diamond on the bar's top edge, flaring as it fires. The HP numbers inside the stage bar sit above the markers.
- **Boss modal** (`BossPanel.vue`). Never reveals which skills a boss has. It shows only active boss-side effects once they've fired: Bloodlust and Reflect (with days left), Undying, and Doom's countdown.
- **Hero status chips** (`CharacterPanel.vue`'s effects list, the same place as Wounds). Wounds, Blind, Sunder and the Doom countdown, each in the existing `bane` tone with days left. Wounds no longer needs its rate in the label, since it's always half.
- **Activity log.** One terse entry per fired skill, one when Scales of Fate makes a skill fail, and one when Doom lands. Reuse the existing `wounds-applied` entry kind for Wounds.
- **HP hits** show as a boss hit on the hero, through the existing hit popup and hit feed.
- **Icons.** Use lucide icons through `statIcons.ts`, matching the existing set.

## Constraints

- Pure game-engine logic. Firing happens inside the engine calls (`completeHabit` and its siblings) and comes back in their results, so `useCombatActions` keeps its "each engine function runs once per action" rule.
- Persistence stays behind the stores. The new fields go on `Boss` and `Character` as optional fields, so old saves load unchanged.
- Day durations use the same semantics as Wounds today (`daysBetweenDayKeys(applied, current) < durationDays`), so "2 days" means the day it fired plus the next day. Undying lasts only the day it fired.
- Seeded tests: today the Wounds ability is rolled before the physical/magic lean. Removing it shifts the lean's rolls. Either update the affected seeded tests or keep a placeholder roll; the builder decides. Roll the skills after everything else in `generateBoss`.

## Left to the builder

- Data shapes: the stored skill list on `Boss`, the new status-effect types (Blind, Sunder), and the boss-side timers (Bloodlust, Undying, Doom).
- How the random slot fill is weighted, as long as the rules above hold. Filling from 75% down to 25%, uniformly among eligible skills, is fine.
- Exact log wording and icon choices, within the terse-copy rule.
- A debug-panel control to spawn a boss with chosen skills, if it helps testing.
- Pacing: skills add pressure from boss #15. The repo has no pacing sim today, so re-check by hand or with a quick script if the numbers feel off.

## Testing

Engine specs alongside the existing ones (`boss.spec.ts`, `combat.spec.ts`, `itemEffects.spec.ts`):
- the count bands and slot placement, including Undying only at 25%, no repeats and at most one HP hit
- crossing and firing rules: fire once, first-only on a multi-cross, nothing on a kill, Echoing Blade carry
- each skill's effect and duration
- the HP-hit 1 HP floor
- Doom's countdown and its "dies first" cancel
- Scales of Fate, Omen Hourglass, and the existing item interactions listed above
- an old save with no stored skills and a leftover `woundsAbility`
