# Streak ranks and boss scaling: design

Date: 2026-10-26. Status: approved by the user 2026-10-26. Next: the implementation plan.

## Why

Past boss ~20 the game turns into a slog. Boss HP grows ×1.27 per boss forever (61k at boss 20, 159k at 24, 666k at 30). The streak bonus (`1 + 0.1 × streak`, so ×4 at 30 days and ×11 at 100) is what lets a player keep up. That bonus disappears on a single miss, but the boss stays sized for it. One or two big-streak skills speedrun you to a boss your other skills can't dent. Then a lost streak leaves you hitting a 170k boss for 1–3k a skill. Level and gear grow far slower than ×1.27 per boss, so nothing else can make up the gap.

Damage pools add a second problem. A miss already hits you once per skill, but each extra skill of a type only grows its pool by about +20%. So every new skill brings its full risk for a fraction of its reward, and the pool math is hard for new players to read.

The user's four streak goals, which this design keeps:

1. Misses are punished with boss hits.
2. Streaks and consistency are rewarded handsomely.
3. Losing a streak takes rewards away.
4. The streak count reflects reality: a 50-day streak means 50 real days in a row.

## Goals

- No slog. A decent player's fights stay at a few days each, even after losing every streak.
- What a streak earned mostly stays after a miss, so a lost streak slows you down but doesn't strand you.
- Big streaks still feel huge. One skill far stronger than the rest is fine and wanted.
- Every extra streak day still buffs the skill.
- Runs end because misses hit harder deep in a run (death from neglect), not because fights drag.
- More skills means more power and more risk: a consistent player with 10 skills is stronger and progresses faster than one with 3, and also takes more hits when they slip. More quests likewise means faster progress, up to a weekly taper.
- Stats read plainly: "Physical 560" is what each physical skill hits for.

## Non-goals

- Boss hits on a miss: the miss-damage S-curve, crits, lifesteal, Sunder etc. stay as they are.
- Boss skills, personalities, resists, the item catalog and drop odds.
- A fight-length safety net ("siege"). The sim's worst case is a perfect player deep into a run at ~10–13 days for one fight. If that still bites in play, revisit it as a follow-up.

## Anti-goals

- Anything that protects a streak. The streak count always drops to 0 on a miss.
- A streak bonus that goes flat at a cap.
- Rank decay. Ranks are never lost: not on a miss and not on death. The user considered and rejected both.
- A daily cap on healing (rejected).

## Design

### Skill ranks

Each skill (habit) gets a `rank`, 0–8, next to its `streakCount`.

- **Rank up.** A daily skill ranks up when its current streak reaches the next milestone above its rank: 10, 20, 30, 50, 100, 200, 300, 500 → ranks 1–8. Rank only rises by actually building the streak, so rank 3 means you really did 30 days in a row at some point. After a miss, getting the next rank needs a fresh streak from 0 that reaches the next milestone. That lost progress is the punishment for a miss, along with the boss hit.
- **Permanent.** Nothing lowers a rank. That covers misses, death (the run reset keeps habits, and ranks with them), Reroll skill, and the Special/Ult/Overdrive reset on death.
- **Hit multiplier.** Replaces `streakMultiplier`: `1 + RANK_BONUS × rank + STREAK_BONUS × streakCount`, with `RANK_BONUS = 1.0` (+100% of base per rank) and daily `STREAK_BONUS = 0.01` (+1% of base per day, forever). Healing skills use +25% per rank instead (see "Healing"). Like today, a hit uses the habit's rank and streak *before* this completion bumps them. The completion that reaches a milestone lands first, then the rank rises.
- **Weeklies** (my call): milestones in weeks are 3, 7, 10, 17, 33, 67, 100, 167, with a streak bonus of `0.03` per week. That's the daily milestones and bonus ÷ 3 and × 3, matching today's rule that one weekly count is worth three daily counts (`WEEKLY_STREAK_MULTIPLIER_PER_COUNT` 0.30 vs 0.10). The rank bonus is the same +100%.
- **Set-day dailies** count due-day completions, like their streak does today. **Bad habits** rank the same way off their resisted-period streak.
- **Milestone EXP** (`MILESTONES` 5/10/20/30/50/100) is unchanged and still re-fires on every crossing.
- **Deleting a skill** loses its rank. A new skill starts at rank 0 (my call).

What a skill with base damage 1,000 hits for:

| Streak | Rank | Hits for | Day after a miss | Today |
|---|---|---|---|---|
| 10 | 1 | 2,100 | 2,000 | 2,000 |
| 20 | 2 | 3,200 | 3,000 | 3,000 |
| 30 | 3 | 4,300 | 4,000 | 4,000 |
| 50 | 4 | 5,500 | 5,000 | 6,000 |
| 100 | 5 | 7,000 | 6,000 | 11,000 |
| 200 | 6 | 9,000 | 7,000 | 21,000 |
| 300 | 7 | 11,000 | 8,000 | 31,000 |
| 500 | 8 | 14,000 | 9,000 | 51,000 |

Today a miss drops every row to 1,000.

A rank-up is shown to the player: an activity-log entry plus a moment on the skill (see "UI").

### No damage pools

Decided 2026-10-26. Each skill hits for its type's full stat, scaled by its difficulty (easy ×2/3, medium ×1, hard ×4/3: today's `DIFFICULTY_WEIGHT` ÷ 1.5), then by rank, streak, gear and the rest as today. Difficulty weighting stays on every skill, healing included, and on quests (`QUEST_DIFFICULTY_MULT`, unchanged). The user asked for both explicitly.

- **What goes away:** `computeDamageSplit`'s share math, `poolSizeMultiplier`, `POOL_GROWTH_PER_MEDIUM_HABIT`, and the pool-driven `dueFraction` weighting.
- **What's unchanged:** a set-day daily hits for the full amount on its due days, so it's naturally worth days/7 of a daily per week. A weekly hits for the full stat × `WEEKLY_BONUS_MULTIPLIER` once a week, the same ratio to a daily as today.
- **Daily/weekly split:** `habitsOfType`'s daily/weekly split no longer matters for damage. Keep it only where something else reads it.
- **Base stats:** physical, magic and true damage drop to 60% of today's, and healing and health stay. That's `BASE_STATS: { physicalDamage: 336, magicDamage: 336, healing: 188, health: 1250, trueDamage: 288 }`. `DAMAGE_SPLIT_RATIOS` still splits the combined 672 physical + magic. The sim checks:
  - With 8 skills, the reference loadout, a decent player gets the fight lengths agreed above: 2.3 / 4.2 days at #20–29 / #30–39, against 2.3 / 4.0 for today's 10 pooled skills.
  - A new player with 3 skills clears boss 1 on day one: 3 × 336 × 0.9 resist ≈ 900 against 650 HP. Fights then run about twice as long as with 8 skills (4.3 / 8.0).
  - With 12–15 skills, fights are shorter and deaths go up.
- **Stat panel:** the character panel's numbers become what a medium skill of that type hits for at rank 0, streak 0. `expectedMediumDailyDamage` and the add-skill preview simplify to that.
- **Skill-count taper** (user's idea, 2026-10-26): habits stay unlimited, but past 15, power levels off the way quests do.
  - Only the newest skills past 15 are weaker; the user rejected both a per-day completion taper and scaling every skill.
  - Owned skills are ranked by creation order. Your 15 oldest skills hit and heal in full. The 16th hits at ×0.7, the 17th at ×0.5, the 18th at ×0.35, and every one after that at ×0.25. The numbers are my call.
  - The factor multiplies that skill's whole hit or heal. Adding a skill never weakens any other skill.
  - Positions follow the skills you own now (my call). Delete one of your 15 oldest and the next skill in line moves up to full power.
  - Creation order is the store's insertion order, or a creation timestamp if that order isn't reliable (builder's call). For an old save with more than 15 skills, the first 15 in the store are the full ones.
  - All owned skills count: daily, weekly, set-day, good, bad and healing (my call).
  - Misses still hit in full however many skills you have. That liability is the deterrent.
  - The factor lowers the skill's Base and has no line of its own (the user's call). How the UI flags a crowded skill is in "UI".
- **Migration:** the in-progress run's `starterStats` physical, magic and true damage scale ×0.6; healing and health are unchanged. That's in the same one-time step as the boss rescale.
- **Delete lock:** a skill added today can't be deleted until tomorrow. That's soft friction against deleting and re-adding a skill to fish for a damage type. `Habit` gets a `createdDayKey` (`dailyPeriodKey` at creation). The skill modal's remove button is disabled while `createdDayKey` is today; my call for its terse label is "Tomorrow". Existing skills have no `createdDayKey` and can be removed as today.

Sim, decent player, with each skill at 60% of today's stat (so about 6 skills deal what they do today), on the new boss curve:

| Skills | Days per boss #20–29 / #30–39 (pools → none) | Deaths in 300 days (pools → none) |
|---|---|---|
| 3 | 3.9 / 6.2 → 4.3 / 8.0 | 4.8 → 4.7 |
| 6 | 3.9 / 6.6 → 3.2 / 5.6 | 3.4 → 4.7 |
| 10 | 2.6 / 4.6 → 1.9 / 3.5 | 8.3 → 11.3 |
| 15 | 2.1 / 3.6 → 1.4 / 2.5 | 8.5 → 11.3 |

Pools never equalized skill counts: 3 skills already fight about twice as long as 10. Dropping them widens 3-vs-15 to about 3×, not 5×, because a slower player reaches each boss later with bigger ranks and streaks. Deaths rise with skill count, as intended. Balance is still judged by fight length, but against the reference loadout, with 3 and 15 skills checked as the extremes. Run it with `SKILLS=n POOLS=0 node scripts/balance-sim.mjs`.

### Quests

The weekly taper stays as the guard against quest spam, but it starts later (my call): the first five quests in a calendar week each pay what the first one pays today, then it tapers. That's `QUEST_SLOT_WEIGHTS: [100, 100, 100, 100, 100, 60, 35, 20, 10, 5, 2]`, with `QUESTS_PER_WEEK_ON_CURVE` and `QUEST_TARGET_LEVEL_FRACTION` unchanged. A medium quest pays 15% of a level and a boss kill 75%, so five quests are about one kill.

### Healing

Decided 2026-10-26. Without pools, stacking healing skills could outheal anything, for example by rerolling until four or five skills heal.

- **Heal-skill cap:** at most 1 in 4 of your skills (rounded up) can be healing. A new skill, Reroll skill and the death reroll skip healing once you're at the cap. That closes reroll fishing, and with the delete lock above, delete-and-re-add fishing too. Reroll skill stays. Existing heal skills over the cap are kept; the cap only applies to new rolls.
- **Slower heal ranks:** healing gets +25% per rank instead of +100%. Damage has to keep up with boss HP, which grows without limit. Healing only has to keep up with hits, which are capped as a share of your HP by the miss curve. The streak part stays +1% a day.
- **Per-skill heal amount:** each heal skill heals the full healing stat, 188, which is 15% of the 1,250 starting HP. Both grow 6% a level, so it stays about 15% of base max HP before rank, streak and gear. That's what today's whole heal pool gives.
- **No daily healing cap.** The user rejected it.

Sim, worst case: 12 skills with the full 3 heal skills. A sloppy player still dies about every 22 days (13.7 deaths in 300 days). With +100% heal ranks it would be 11.3; with heal 150 instead of 188, 16.0. Healing helps but doesn't erase misses. The decent player is at about 6 deaths with any of these settings.

### Boss HP growth

`BOSS_HEALTH_GROWTH_RATE` (1.27) becomes bands: ×1.27 per boss through boss 12, ×1.17 from boss 13, ×1.11 from boss 31, ×1.09 from boss 51. That's `BOSS_HEALTH_GROWTH_BANDS: [[1, 1.27], [13, 1.17], [31, 1.11], [51, 1.09]]`, where each row's rate applies to every boss from that index on. The first pick was ×1.15 from 13; the user found those fights a little short, so it went up to ×1.17, which makes fights at #20–39 about 20% longer. The tank multiplier, ±10% jitter, hidden run modifier, resists and personalities are unchanged.

| Boss | New HP | Today |
|---|---|---|
| 10 | 5,587 | 5,587 |
| 15 | 14,432 | 18,457 |
| 20 | 31,640 | 60,980 |
| 25 | 69,370 | 201,466 |
| 30 | 152,090 | 665,612 |
| 40 | 431,847 | 7.3M |
| 50 | 1.2M | 79M |
| 60 | 2.9M | 866M |
| 100 | 91M | 12 trillion |

### EXP: kills and daily skills

Decided 2026-10-26. The user wants EXP-gain items to really speed progression, without runaway, and boss kills to still feel substantial.

- **Boss kill:** pays 40% of the full cost of your current level (`expToNextLevel(level)`, not the EXP still remaining), jittered ±10% so level-ups don't feel scheduled. That's `TUNING.BOSS_KILL_LEVEL_SHARE = 0.4`. It replaces `BASE_BOSS_EXP` × `BOSS_EXP_GROWTH_RATE`^(index−1). A kill always pays at least 33 EXP, today's boss-1 reward, so the first few levels still come on the first kills as they do now (my call).
- **Daily skill EXP (new):** each day's dailies share 20% of a level, split equally among the dailies due that day (`TUNING.DAILY_SKILL_LEVEL_SHARE = 0.2`). With 8 due, each completion pays 2.5%. The user picked the equal split, so difficulty doesn't change EXP; it still changes damage. Splitting by what's due today (my call) means a full day always pays the whole 20%, even when set-day skills rest. Resisted bad habits count as completions. Because it's a share, it rewards consistency, not skill count; per-completion EXP would let a 15-skill player out-level a 3-skill one about 5× and compound the damage gap.
- **Weekly skill EXP (new, decided):** each week's weeklies share 30% of a level, split equally among them (`TUNING.WEEKLY_SKILL_LEVEL_SHARE = 0.3`; the user picked 30% over the proposed 40%). It's paid on each completion. A full week of weeklies pays a bit under one boss kill, and the dailies' 20% stays as tuned. This extra EXP only goes to players who carry weeklies, which also hit twice as hard when missed. Not yet simmed (the sim has no weeklies); it doesn't touch the runaway math, since it's tied to real weeks, not kills.
- **EXP-gain items** multiply every grant: kills, daily skills, milestones and quests. They really do speed you up.
- **Milestone and quest EXP** are unchanged.

**Why this doesn't run away.** Runaway is kills feeding kills: a kill's levels have to buy enough damage to pay for the next boss's extra HP. A kill adds `1.06^(share × (1 + EXP bonus))` of power. At 3/4 of a level, a +100% EXP build makes that ×1.09, which matches the deepest boss band. At 40%, it takes about +270% to get there, far beyond any real build. Daily EXP doesn't loop: it's tied to real days, so it makes fights shorter but steady.

**Why not "fewer levels a kill, but more stats per level" instead.** Runaway depends on levels per kill × stats per level, so trading one for the other changes nothing.

Sim (8 skills, no pools), days per boss at #30–39 / #40–59 / #60–99:

| | 3/4 kill only (rejected) | 40% kill + 20% daily (picked) | 1/3 kill + 1/3 daily |
|---|---|---|---|
| perfect, no EXP items | 3.3 / 5.1 / 7.3 | 3.1 / 3.8 / 4.2 | 2.7 / 2.9 / 3.0 |
| good, no EXP items | 3.8 / 5.2 / 7.2 | 3.7 / 4.2 / 4.3 | 3.2 / 3.3 / 3.2 |
| decent, no EXP items | 4.2 / – / – | 4.2 / – / – | 3.7 / 3.6 / – |
| perfect, +50% EXP | 31 of 40 hit boss 100 by day ~243 | 2.1 / 2.3 / 2.3 | 1.8 / 1.8 / 1.7 |
| perfect, +100% EXP | 1.3 / 1.1 / 0.9 (all hit boss 100 by day ~97) | 1.5 / 1.4 / 1.4 | 1.3 / 1.2 / 1.1 |

On the picked split, fight length levels off at about 4 days deep in a run instead of growing into a wall. EXP items shorten fights in proportion and stay steady. A perfect player with +50% reaches about boss 100 by day ~200; that's a steady pace, not an acceleration.

Rejected (Claude's recommendation): scaling kill EXP by fight length, less for quick kills and more for slow ones. It quietly taxes consistent play, and fights are already short.

**Every boss growth band must stay above ~×1.05**, with margin, for the runaway argument to hold. This replaces the old "BOSS_EXP_GROWTH_RATE must stay below BOSS_HEALTH_GROWTH_RATE" rule; rewrite those tuning comments. The activity log's "boss defeated" amount (`useCombatActions`) shows the new value. `bossExpReward` takes the level instead of the boss index. `MAX_LEVEL_UPS_PER_GRANT` stays as defense in depth.

### Expected level table

The new boss curve and EXP sources change the level a player has when each boss spawns. `EXPECTED_LEVEL_BY_BOSS_INDEX`, which boss attacks are sized against, becomes: `[1, 1], [5, 4], [10, 7], [15, 11], [20, 15], [25, 20], [30, 25], [40, 38], [50, 49]`. That's the sim's median over the decent and good players, with 8 skills, no pools, 40% kill + 20% daily EXP and the 33-EXP floor (`KILL_SHARE=0.4 DAILY_EXP=0.2 KILL_FLOOR=33 TABLE=1`). Rewrite its comment so it points at the sim instead of the old 52-week sim.

### In-progress run (one-time migration)

- **Habits.** A habit with no `rank` gets the number of rank milestones its current `streakCount` has reached: daily or weekly milestones by period. The game stores no best-ever streak, so past broken streaks don't count. Run it at hydration, like `migrateHabitDamageType`, and make it idempotent: it only fills a missing field.
- **Current boss.** Scale `health` and `maxHealth` by `newBase(index) / oldBase(index)`, both without the run modifier, so the ratio cancels it. That keeps the boss's HP percent, and breakpoints are percents, so armed skills stay valid. Gate it with a one-time flag, as `damagePoolRebalanceApplied` does, so it never re-applies. The user's current ~170k boss (~#24) becomes ~64k.
- Level, EXP, items and quests are untouched. The current boss keeps its attack stats; only its HP is rescaled. The next boss picks up the new expected-level table (my call; it's one fight).
- Ranks the migration fills in get no log entries (my call).
- Wire it so the migration's own write persists. `setupPersistence` must run before `initFromSave`, which is already true (see the 2026-10-04 bug in the MVP notes).

### UI

Mockups, in Ashen: `docs/mockups/skill-ranks.html`, `skill-ranks-2.html`, `skill-ranks-3.html` and `skill-ranks-4.html` (rounds 1–4).

Decided:
- **Difficulty leaves the skill row.** It shows in the skill modal only, as pips next to the damage type.
- **On the row, the diamonds now show rank,** 1–8, in place of the difficulty pips. Rank 0 shows nothing.
- **Rank-up:** the row flares, with a gold sweep and "Rank V" rising off it, and the log gets a line (round 1, option 2).
- **The skill modal gets a progress bar toward the next rank** ("VI at 200").

- **Rank diamonds:** one line, one gold diamond per rank (round 2, option A).
- **Skill modal:** round 2, layout A, keeping everything the modal has today: days, the breakdown, Special/Ult, the total, Overdrive and Remove.
  - A Rank block sits under the type line, with the rank numeral, its diamonds, and a bar to the next rank ("VI at 200", in weeks for weeklies).
  - The sum has separate Rank and Streak lines (e.g. Rank V +500%, Streak 112 +112%).
  - The remove button shows the Tomorrow lock on a skill added today.
- **Crowded:** no separate line. A crowded skill's Base is simply lower; the crowding factor is folded into `baseDamage`.

- **Crowded display:** in the modal only, Base is ash grey with an italic "crowded" note (round 3, option A). The skill row shows nothing.

- **Difficulty in the modal:** the word, in the type line's engraved caps ("Physical · Hard"). That's round 4, option A, `docs/mockups/skill-ranks-4.html`. The old difficulty pips are gone everywhere, since rank owns the diamonds now.

Copy stays terse: a rank numeral, never an explanation.

Records set before this change came from steeper bosses. Nothing is done about that; the user should just know.

## Sim

`scripts/balance-sim.mjs` (run: `node scripts/balance-sim.mjs`, about 1 second). It's a small day-by-day model, not the engine:

- 10 medium dailies: 4 physical, 3 magic, 2 healing, 1 true damage.
- Today's pool split, level growth and resists.
- Items as a saturating multiplier on kills this run.
- Misses hit by today's miss curve; healing and level-up heals restore HP. Streaks survive death, and so do ranks.
- 40 seeds × 300 days per player type.
- Left out: boss skills, lifesteal, armor items, item effects, events, weeklies. It likely overstates deaths for everyone alike.

Players (chance to do each skill each day):
- **perfect:** 98%.
- **good:** about 93%.
- **decent:** about 85%, with 3 skills at 95%+.
- **sloppy:** about 65%.
- **lapse:** decent, plus a 10%-completion week at day 150.

This table was run with today's pools and 10 skills. The no-pool base stats above were picked to reproduce it with 8 skills (see "No damage pools").

Average days per boss by boss number. "Longest" is the longest single fight, as median / worst across seeds; for lapse it's the longest fight after the bad week.

| Player | | Deaths in 300 d | Best boss | #10–19 | #20–29 | #30–39 | #40–59 | #60–99 | Longest |
|---|---|---|---|---|---|---|---|---|---|
| perfect | today | 0.1 | 43 | 1.8 | 5.3 | 13.4 | 18.4 | – | 29.5 / 39.8 |
| | **new** | 0.4 | 75 | 1.3 | 2.0 | 3.1 | 4.9 | 7.1 | 9.9 / 12.8 |
| good | today | 2.5 | 32 | 1.8 | 7.0 | 14.4 | – | – | 17.3 / 36.8 |
| | **new** | 3.0 | 46 | 1.0 | 2.2 | 4.0 | 5.5 | – | 7.4 / 13.8 |
| decent | today | 9.6 | 23 | 2.1 | 4.9 | – | – | – | 6.7 / 16.7 |
| | **new** | 10.5 | 29 | 1.2 | 2.3 | 4.0 | – | – | 4.5 / 5.7 |
| sloppy | today | 28.3 | 13 | 1.9 | – | – | – | – | 2.9 / 4.1 |
| | **new** | 27.9 | 15 | 1.6 | – | – | – | – | 2.7 / 3.7 |
| lapse | today | 11.1 | 22 | 2.2 | 5.1 | – | – | – | 6.2 / 11.7 |
| | **new** | 12.2 | 29 | 1.2 | 2.3 | 3.8 | – | – | 4.0 / 5.6 |

Variants that lost:
- **Ranks with ×1.27 bosses:** ranks alone don't fix it. A perfect player still averages 12.8 days at #30–39.
- **×1.17 bosses with today's EXP:** runaway. Every perfect player hit boss 100 by day 122, and 13 of 40 good ones by day 234.
- **A kill pays one full level, same bands:** close to runaway. A perfect player reaches about boss 97 in 300 days (on the ×1.15 bands, 34 of 40 hit boss 100), and there's a level-up (so an event pick) nearly every kill.
- **A kill pays half a level, same bands:** the wall creeps back. A perfect player averages 7.0 days at #40–59 and 9.7 at #60–99; a good one averages 5.5 at #30–39, and a decent one 6.5.
- **×1.15 from boss 13 (the first pick):** about 20% shorter fights at #20–39 (perfect 1.7 / 2.5, decent 1.9 / 3.2). The user wanted a touch longer. ×1.16 is the in-between option if ×1.17 drags.

The decent player dies a bit more often than today (10.5 vs 9.6 deaths in 300 days) because they reach harder-hitting bosses sooner. That's consistent with "death from neglect": the good player dies about every 100 days, the sloppy one about every 11.

## Known risk

Fights are shorter, so deep in a run, boss skills fire about 4× as often per day; the sim leaves boss skills out. Boss skills stay out of scope here. Watch for it in play, and if Rend/Ravage/Doom start chaining, look at them then.

## Left to the builder

- TUNING key names and shapes, beyond the values above.
- Where rank-up detection lives; `completeHabitStreak` is the natural spot, since every completion path goes through it.
- How `HabitDamageBreakdown` exposes rank vs. streak for the modal.
- Where the one-time boss-rescale flag lives, and whether rank goes into the high-score run snapshot.
- Tests, following the existing spec files.

## Waiting on the user

- Nothing. The spec is approved.
