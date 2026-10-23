# Set-day skills — Design Spec

Status as of 2026-10-23. Lets a daily rest on chosen days of the week: a habit that behaves like a daily but only falls on days of the week the player picks (gym on Mon · Wed · Sat, deep work Mon–Fri). Mockup: `docs/mockups/set-days.html` (picked: List **C**, Forge **B**, Skill popup **C**).

## Why

Players have habits that aren't every day but aren't once-a-week either. Today they have to fake those as a daily (and eat a miss on every rest day) or a weekly (wrong rhythm, wrong reward). A set-day habit should feel exactly like a daily on the days it's due and simply not exist on the days it isn't.

## Goals

- **Hits like a regular daily.** On a due day, a set-day habit of a given difficulty hits exactly like a regular daily of that difficulty in the same pool. No weekly-style bonus.
- **Steady numbers.** No habit's damage number changes from one day of the week to the next. (The player explicitly rejected a design where other dailies' numbers rose on rest days.)
- **Fewer days never pays.** Picking fewer days must never meaningfully raise the damage a player gets for their effort (see the ≤2% edge under Known edges).
- **Rest days are free.** Nothing happens on a day a habit isn't due: no miss, no streak break, no reward for a bad habit.

## Non-goals

- No new pool, no new multiplier, no change to weeklies.
- No "every other week", "3 times a week, any days", or monthly cadences.
- No backfill of missed days while the app was closed (same MVP rule as dailies, see `useDailyRollover.ts`).

## Anti-goals

- A set-day habit becoming the best way to deal damage (e.g. one-day-a-week habits that each land a whole week's worth of damage).
- Adding a set-day habit making the player's existing dailies noticeably weaker, the trap weeklies fell into when they shared the daily pool.
- Explanatory UI copy. Player-facing text stays terse (see the terse-UI rule): no "rests on these days" sentences, no tooltips explaining the pool.

## Confirmed product decisions

- **Same pool as dailies, counted as part of a habit.** A set-day habit sits in its damage type's *daily* pool, weighted by the fraction of the week it's due. Gym on 3 days counts as 3/7 of a habit, every day. Worked example the player approved: a lone medium reading daily hits 100; add a medium gym on Mon · Wed · Sat and both hit ~76 (reading every day, gym on its days). As a regular daily, both would have hit 60.
- **Misses are normal daily misses** (×1, no weekly ×2), checked only on due days.
- **Streak counts due days.** Mon then Wed is 2 in a row for a Mon · Wed · Sat habit. Uses the daily streak rate (`STREAK_MULTIPLIER_PER_COUNT`).
- **Overdrive works exactly as on a daily** (same extra uses per day). On a rest day neither the habit nor its Overdrive can be used.
- **Special can land on one** (it's a daily).
- **Bad habits can be set-day** ("no junk food on weekdays"). Avoiding it on a due day is the reward; rest days do nothing either way.
- **All seven days = a plain daily.**
- **Changing days keeps the streak.**
- **Weekly habits are unchanged.**

## The damage math

Today (`habits.ts` `computeDamageSplit`), each habit in a (damage type, period) pool gets:

```
W      = Σ w_j                       // w = DIFFICULTY_WEIGHT[difficulty]  (easy 1, medium 1.5, hard 2)
pool   = S * poolSizeMultiplier(W)
d_i    = pool * w_i / W
```

New: each habit also has a **due fraction** `f = dueDays / 7` (1 for a plain daily and for every weekly):

```
W      = Σ w_j * f_j
pool   = S * poolSizeMultiplier(W)
d_i    = pool * w_i / max(W, w_i)    // per hit, on a day it's due
```

- `w_i / W`, not `w_i * f_i / W`, is what makes a set-day hit equal a regular daily's hit of the same difficulty: the habit "saves up" its fractional share over the week and spends it on its due days.
- Over a week every habit's hits add up to `7 * pool * (w_i f_i / W)`, so the pool's weekly total is `7 * pool`, the same rule dailies follow now. Fewer days means less `W`, so the pool can only get smaller.
- **The `max(W, w_i)` cap** (equivalently: no single hit can exceed the whole pool). Without it, a pool made mostly of set-day habits gets a tiny `W` and each hit balloons: a lone medium one-day-a-week habit would hit for 7× a lone daily, a whole week's damage in one check. With the cap, a set-day habit hits at most what it would if it were your only habit of that type. Regular dailies always have `W ≥ w_i`, so they're never affected. Side effect, accepted: in a pool dominated by sparse heavy habits, the weekly total is a bit lower than `7 * pool` (the player is doing fewer checks).
- `expectedMediumDailyDamage` (CharacterPanel's Effective column) uses the same fractional `W`. The hypothetical new medium daily joins at `f = 1`.
- The breakdown in the skill popup is unchanged: Base is `d_i` before items/streak/Special, same rows as a daily. No new multiplier row.

## Data

- `Habit.days?: number[]` (or similar name): ISO weekday indexes, **Mon = 0 … Sun = 6**, sorted and unique, length 1–6. Only meaningful when `period === 'daily'`. Undefined (or seven days) means a plain daily. Normalize seven picked days to undefined on save.
- Stays `period: 'daily'` so every existing daily path (pool membership, streak rate, Special eligibility, period keys, completion stamps) keeps working without changes.
- Additive optional field, no `CURRENT_SCHEMA_VERSION` bump and no migration needed (an old save just has no set-day habits). This follows the existing pattern for optional `Habit` fields.
- The weekday is the weekday of the **Pacific business day** (3am-to-3am, see `pacificBusinessDay` in `time.ts`). Add a helper alongside `dailyPeriodKey`, e.g. `dayOfWeekIndex(date)`, so the weekday and the day key always agree. "Due today" = `days` includes `dayOfWeekIndex(now)` (via the debug clock in the UI).

## Engine behavior

- **Rollover** (`useDailyRollover.ts`): for a set-day habit whose period has advanced, look at the *preceding* day's weekday. If it wasn't a due day, stamp `lastCheckedPeriodKey` and queue nothing (no miss, no bad-habit reward). If it was, behave exactly like a daily today. Still only the single preceding day is checked.
- **Check-off**: disallowed on a rest day (both good and bad habits). The UI already can't reach it, but `checkOffHabit` should guard too.
- **Overdrive**: no change to `grantOverdrive` or the Overdrive event; set-day habits can get it like any good habit. `activateOverdrive` must also refuse on a rest day. That's not implied by "checked off this period": a habit checked off today can have today removed from its days in the popup afterwards, and from then on neither it nor its Overdrive can be used today.
- **Special**: no change, set-day good dailies stay eligible.
- **Death**: habits are kept as now; their days carry over.
- **ProgressSummary** ("Daily done X / Y"): habits resting today are left out of both counts.

## UI

All new structure is built with the components' base (scoped) styles, which is the Minimalist look; the Ashen look goes in `src/assets/scss/themes/ashen.scss`, the same split the current skills UI uses. Follow the mockup for Ashen.

### Skills list — HabitList / HabitListItem (mockup List C)

- Set-day habits live in the **Daily** group, sorted with it by damage type.
- **Due today:** looks exactly like any other daily. No marker.
- **Resting today:** moves out of the main Daily list into a single fold at the bottom of the Daily group: **"Resting N"**. Collapsed every time the app loads. Hidden entirely when nothing rests today.
- Inside the fold, each row keeps its name, streak, pips and its normal damage number, dimmed; its diamond is hollow/dashed and can't be checked; it shows the **short name of the next day it's due** ("Wed") as a small tag.
- Tapping a resting row opens its skill popup like any row.
- The fold's toggle row is a ≥44px tap target.

### Forge a habit — AddHabitModal (mockup Forge B)

- **No new cadence.** Cadence stays two cards, Daily · Weekly.
- While **Daily** is selected, a row of seven diamond day buttons (M T W T F S S, Monday first) shows under the cards. **All seven start lit** every time the form opens. Tapping a day lets it rest (unlit); tapping again lights it. Full-width grid, 44px tall.
- The Daily card's hint shows the count: "Every day" with all seven, otherwise "5 days" etc.
- At least one day stays lit (the last lit day can't be turned off).
- Weekly selected: the day row is hidden.
- All seven lit saves as a plain daily.
- `addHabit` / `createHabit` / `habitStore.addHabit` take the days.

### Skill popup — HabitStatsModal (mockup Skill popup C)

- For any **daily** (plain or set-day), the line above the sum loses "Daily" and a **tappable week** appears under it, labelled "Days" with the count on the right ("3 days", "Every day"). A plain daily shows all seven lit.
- Each tap saves immediately (no save button) and the Base / total update live.
- Same rules as Forge: at least one day lit; seven lit = plain daily.
- On a rest day the total number dims (as in the mockup).
- The Overdrive button shows for an Overdrive habit as it does today; on a rest day it's disabled like the check.
- Weekly popups are unchanged.

## Left to the builder

- Exact field and helper names, and where the fractional weight lives (`computeDamageSplit` vs. a small `dueFraction(habit)` helper).
- How the Resting fold is built (`<details>` or a toggle), as long as it starts closed each load.
- Test coverage. At minimum: the split math (incl. the cap and the approved 100 → 76 example), rollover on a rest day vs. a due day for good and bad habits, the weekday helper across the 3am boundary, Overdrive refused on a rest day (including after today is removed from a checked-off habit), and day normalization (seven → undefined).
- Log/high-score records: no need to carry days into them.

## Known edges, accepted

- In pools made mostly of set-day habits, the cap can make dropping a day from a heavy habit raise the week's total slightly. Worst case found: about 1.9% (a hard set-day habit beside an easy one on 5 days; 1 day deals 6.00 S over the week, 2 days 5.89 S). Too small to notice; keep the formula as written. A "fewer days never raises the weekly total" property test should only cover pools where the cap doesn't kick in. (Builder's call.)
- Rollover runs on app mount. If the app is left open past 3am, a player could remove yesterday from a habit's days before reloading and dodge that miss. Same class of gap the app already has; not worth a guard.
- Tapping days in the popup changes the habit's weight in the pool immediately, so the other dailies' numbers in that damage type shift once. That's a one-time change the player caused, not a day-to-day one.
