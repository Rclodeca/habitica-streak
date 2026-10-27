<script setup lang="ts">
// The ten best runs as a wall of the fallen (docs/mockups/high-scores-d.html,
// option D2): each run is its greyed hero, name and epitaph. Tapping one opens
// its sheet over the list, the hero facing the boss that ended the run.

import { computed, ref } from 'vue';
import { describeItemBonus, formatCompact, ITEM_CATALOG, PERSONALITY_NAME } from '../../game-engine';
import type { DamageType } from '../../game-engine';
import type { HighScoreRun, HighScoreRunItem } from '../../store/highScoreStore';
import { runHero, useHighScoreStore } from '../../store/highScoreStore';
import { BOSS_FACING_RIGHT, PERSONALITY_SPRITE } from '../boss/bossSprites';
import { DRAWN_FACING_LEFT } from '../character/heroArt';
import Modal from '../ui/Modal.vue';
import StatIcon from '../ui/StatIcon.vue';
import type { StatIconName } from '../ui/statIcons';

const highScoreStore = useHighScoreStore();
const baseUrl = import.meta.env.BASE_URL;

// The open sheet, by its place on the list (rank - 1).
const openIndex = ref<number | null>(null);
const openRun = computed(() => (openIndex.value === null ? undefined : highScoreStore.topRuns[openIndex.value]));
const sheetOpen = computed({
  get: () => openRun.value !== undefined,
  set: (open) => {
    if (!open) openIndex.value = null;
  },
});
const openHero = computed(() => (openRun.value ? runHero(openRun.value) : undefined));

function heroArt(run: HighScoreRun): string {
  return `${baseUrl}sprites/player/${runHero(run).heroClass}.png`;
}

// Only what the hero wore; older runs also saved the unequipped items.
function equipped(run: HighScoreRun): HighScoreRunItem[] {
  return run.items.filter((item) => item.equipped);
}

function rarityStyle(item: HighScoreRunItem) {
  const rarity = ITEM_CATALOG.find((i) => i.id === item.id)?.rarity ?? 'common';
  return { '--rarity': `var(--rarity-${rarity})` };
}

function itemStats(item: HighScoreRunItem): string {
  if (item.stats !== undefined) return item.stats;
  const def = ITEM_CATALOG.find((i) => i.id === item.id);
  return def ? describeItemBonus(def) : '';
}

function daysText(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

// Day keys are YYYY-MM-DD (see game-engine/time.ts) — parsed as local
// calendar values (not UTC) since that's all a day key carries.
function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const DAMAGE_TYPE_ICON: Record<DamageType, StatIconName> = {
  physical: 'physical',
  magic: 'magic',
  healing: 'healing',
  trueDamage: 'true',
};
</script>

<template>
  <section class="panel high-score-page">
    <h2>High Scores</h2>
    <p v-if="!highScoreStore.topRuns.length">
      No runs completed yet — your best 10 will show up here after your first death.
    </p>
    <template v-else>
      <p class="page-note">Your ten deepest runs.</p>
      <ol class="epitaphs">
        <li v-for="(run, i) in highScoreStore.topRuns" :key="run.id">
          <button type="button" class="epitaph" :class="{ best: i === 0 }" @click="openIndex = i">
            <span class="epitaph-pic"><img :src="heroArt(run)" alt="" /></span>
            <span class="epitaph-body">
              <span class="epitaph-head">
                <span class="epitaph-name">{{ runHero(run).name }}</span>
                <span class="epitaph-rank" :class="{ podium: i < 3 }">#{{ i + 1 }}</span>
              </span>
              <span class="epitaph-line">Fell before <b>Boss {{ run.bossIndex }}</b> at level {{ run.level }}.</span>
              <span class="epitaph-tail">
                <span class="gear-strip">
                  <span v-for="item in equipped(run)" :key="item.id" class="gear-chip" :style="rarityStyle(item)">
                    <img :src="`${baseUrl}sprites/${item.icon}.png`" alt="" />
                  </span>
                </span>
                <span class="epitaph-days">{{ daysText(run.daysLived) }}</span>
              </span>
            </span>
          </button>
        </li>
      </ol>
    </template>

    <Modal v-model="sheetOpen" :title="openIndex === null ? undefined : `Rank ${openIndex + 1}`" :scroll-key="openRun?.id">
      <div v-if="openRun && openHero" class="run-sheet">
        <div class="duel">
          <img
            class="duel-hero"
            :class="{ flip: DRAWN_FACING_LEFT[openHero.heroClass] }"
            :src="`${baseUrl}sprites/player/${openHero.heroClass}.png`"
            alt=""
          />
          <img
            v-if="openRun.bossPersonality"
            class="duel-boss"
            :class="{ flip: BOSS_FACING_RIGHT[openRun.bossPersonality] }"
            :src="`${baseUrl}sprites/${PERSONALITY_SPRITE[openRun.bossPersonality]}.png`"
            alt=""
          />
        </div>
        <h3 class="run-hero">{{ openHero.name }}</h3>
        <p class="run-epitaph">
          <template v-if="openRun.bossPersonality">
            Fell to <b>{{ PERSONALITY_NAME[openRun.bossPersonality] }}</b>, Boss {{ openRun.bossIndex }}, at level {{ openRun.level }}.
          </template>
          <template v-else>Fell before <b>Boss {{ openRun.bossIndex }}</b> at level {{ openRun.level }}.</template>
        </p>
        <p class="run-dates">
          {{ formatDayKey(openRun.startedDayKey) }} – {{ formatDayKey(openRun.endedDayKey) }} · {{ daysText(openRun.daysLived) }}
        </p>

        <p class="stat-summary">
          <span><StatIcon name="physical" /> {{ formatCompact(openRun.stats.physicalDamage) }}</span>
          <span><StatIcon name="magic" /> {{ formatCompact(openRun.stats.magicDamage) }}</span>
          <span><StatIcon name="healing" /> {{ formatCompact(openRun.stats.healing) }}</span>
          <span><StatIcon name="true" /> {{ formatCompact(openRun.stats.trueDamage) }}</span>
          <span><StatIcon name="crit" /> {{ (openRun.stats.critChance * 100).toFixed(0) }}%</span>
        </p>

        <template v-if="equipped(openRun).length">
          <h4 class="run-section">Equipped</h4>
          <ul class="run-gear">
            <li v-for="item in equipped(openRun)" :key="item.id">
              <span class="gear-chip" :style="rarityStyle(item)">
                <img :src="`${baseUrl}sprites/${item.icon}.png`" alt="" />
              </span>
              <span>
                <span class="run-gear-name">{{ item.name }}</span>
                <span class="run-gear-stats" :class="{ enchanted: item.enchanted }">{{ itemStats(item) }}</span>
              </span>
            </li>
          </ul>
        </template>

        <template v-if="openRun.habits.length">
          <h4 class="run-section">Skills</h4>
          <ul class="run-skills">
            <li v-for="(habit, hi) in openRun.habits" :key="hi">
              <StatIcon :name="DAMAGE_TYPE_ICON[habit.damageType]" />
              {{ habit.name }}
              <span class="run-skill-period">{{ habit.period }}</span>
              <span class="run-skill-streak"><StatIcon name="streak" :size="13" />{{ habit.streakCount }}</span>
            </li>
          </ul>
        </template>
      </div>
    </Modal>
  </section>
</template>

<style scoped>
.page-note {
  margin: 0 0 0.5rem;
  opacity: 0.75;
}

.epitaphs {
  list-style: none;
  margin: 0;
  padding: 0;
}

.epitaphs li + li {
  border-top: 1px solid var(--border);
}

.epitaph {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 0 0.75rem;
  width: 100%;
  min-height: 76px;
  padding: 0.6rem 0.5rem 0.6rem 0.25rem;
  background: none;
  border: none;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.epitaph-pic {
  position: relative;
  width: 64px;
  height: 64px;
}

/* A shadow under the fallen hero's feet. */
.epitaph-pic::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 6px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0, 0, 0, 0.6), transparent 70%);
}

.epitaph-pic img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: grayscale(0.85) brightness(0.7);
}

/* The record keeps its colour. */
.epitaph.best .epitaph-pic img {
  filter: grayscale(0.2) brightness(0.95);
}

.epitaph-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.epitaph-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.epitaph-name {
  font-weight: 700;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.epitaph-rank {
  margin-left: auto;
  font-weight: 700;
  opacity: 0.6;
}

.epitaph-rank.podium {
  color: var(--accent);
  opacity: 1;
}

.epitaph-line {
  margin-top: 0.1rem;
  font-size: 0.9em;
  line-height: 1.2;
}

.epitaph-line b,
.run-epitaph b {
  color: var(--damage-color);
}

.epitaph-tail {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.gear-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.epitaph-days {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.75em;
  opacity: 0.7;
}

/* An item's art in a frame of its rarity's colour. */
.gear-chip {
  --size: 18px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--size);
  height: var(--size);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--rarity) 55%, transparent);
  border-radius: 3px;
  background: radial-gradient(circle, color-mix(in srgb, var(--rarity) 18%, transparent), rgba(0, 0, 0, 0.4) 75%);
}

.gear-chip img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  transform: scale(1.4);
}

/* ---------- The run's sheet ---------- */

/* The fallen hero (greyed) and the boss that ended the run, facing each other. */
.duel {
  position: relative;
  height: 128px;
  margin: 0 -0.25rem 0.4rem;
}

.duel img {
  position: absolute;
  bottom: 4px;
  object-fit: contain;
  image-rendering: pixelated;
}

.duel-hero {
  left: 18px;
  width: 92px;
  height: 92px;
  filter: grayscale(0.85) brightness(0.75);
}

.duel-boss {
  right: 6px;
  width: 132px;
  height: 132px;
}

/* A hero with no boss saved (an older run) stands alone, centred. */
.duel-hero:only-child {
  left: calc(50% - 46px);
}

.duel .flip {
  transform: scaleX(-1);
}

.run-hero {
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  color: var(--text-h);
}

.run-epitaph {
  margin: 0.2rem 0 0;
  text-align: center;
}

.run-dates {
  margin: 0.5rem 0 0.75rem;
  text-align: center;
  font-size: 0.75em;
  opacity: 0.7;
}

.stat-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.55rem;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-h);
}

.stat-summary span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.run-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.9rem 0 0.45rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
}

.run-section::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.run-gear,
.run-skills {
  list-style: none;
  margin: 0;
  padding: 0;
}

.run-gear li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.2rem 0;
  font-size: 0.9em;
}

.run-gear .gear-chip {
  --size: 28px;
}

.run-gear-name {
  display: block;
  font-weight: 600;
  line-height: 1.1;
  color: var(--text-h);
}

.run-gear-stats {
  display: block;
  font-size: 0.85em;
  line-height: 1.2;
  opacity: 0.8;
}

.run-gear-stats.enchanted {
  color: var(--accent-solid);
  opacity: 1;
}

.run-skills li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.15rem 0;
  font-size: 0.9em;
}

.run-skill-period {
  font-size: 0.85em;
  opacity: 0.6;
}

.run-skill-streak {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: auto;
  font-weight: 600;
}
</style>
