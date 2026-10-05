<script setup lang="ts">
import { reactive } from 'vue';
import type { DamageType } from '../../game-engine';
import { useHighScoreStore } from '../../store/highScoreStore';

const highScoreStore = useHighScoreStore();

// Keyed by run id — which cards have their full stats/items/skills shown,
// collapsed by default so 10 runs don't turn into a wall of text.
const expanded = reactive<Record<string, boolean>>({});
function toggle(id: string) {
  expanded[id] = !expanded[id];
}

// Day keys are YYYY-MM-DD (see game-engine/time.ts) — parsed as local
// calendar values (not UTC) since that's all a day key carries.
function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  physical: '⚔️',
  magic: '🔮',
  healing: '💚',
  trueDamage: '⚡',
  expGain: '✨',
};
</script>

<template>
  <section class="panel high-score-page">
    <h2>High Scores</h2>
    <p v-if="!highScoreStore.topRuns.length">
      No runs completed yet — your best 10 will show up here after your first death.
    </p>
    <ol v-else class="run-list">
      <li v-for="(run, i) in highScoreStore.topRuns" :key="run.id" class="run-card">
        <button type="button" class="run-summary" @click="toggle(run.id)">
          <span class="rank">#{{ i + 1 }}</span>
          <span class="run-headline">Boss #{{ run.bossIndex }} · Lv. {{ run.level }}</span>
          <span class="run-meta">{{ run.daysLived }}d lived · started {{ formatDayKey(run.startedDayKey) }}</span>
        </button>

        <div v-if="expanded[run.id]" class="run-details">
          <p class="stat-summary">
            <span>⚔️ {{ run.stats.physicalDamage.toFixed(0) }}</span>
            <span>🔮 {{ run.stats.magicDamage.toFixed(0) }}</span>
            <span>💚 {{ run.stats.healing.toFixed(0) }}</span>
            <span>⚡ {{ run.stats.trueDamage.toFixed(0) }}</span>
            <span>✨ {{ run.stats.expGain.toFixed(0) }}</span>
            <span>💥 {{ (run.stats.critChance * 100).toFixed(0) }}%</span>
          </p>

          <template v-if="run.items.length">
            <h4>Items</h4>
            <ul class="detail-list">
              <li v-for="item in run.items" :key="item.id">
                {{ item.name }}
                <span v-if="item.equipped" class="equipped-tag">equipped</span>
              </li>
            </ul>
          </template>

          <template v-if="run.habits.length">
            <h4>Skills</h4>
            <ul class="detail-list">
              <li v-for="(habit, hi) in run.habits" :key="hi">
                {{ DAMAGE_TYPE_ICON[habit.damageType] }} {{ habit.name }}
                <span class="habit-meta">({{ habit.period }} · streak {{ habit.streakCount }})</span>
              </li>
            </ul>
          </template>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.run-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.run-card {
  border: 1px solid var(--border);
  border-radius: 8px;
}

.run-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0.6rem 0.75rem;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.rank {
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
}

.run-headline {
  font-weight: 600;
  color: var(--text-h);
}

.run-meta {
  font-size: 0.8em;
  opacity: 0.75;
}

.run-details {
  padding: 0 0.75rem 0.75rem;
  border-top: 1px solid var(--border);
}

.run-details h4 {
  margin: 0.75rem 0 0.3rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
}

.stat-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-h);
}

.detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
}

.detail-list li {
  padding: 0.15rem 0;
}

.equipped-tag {
  margin-left: 0.4em;
  font-size: 0.75em;
  color: var(--accent);
}

.habit-meta {
  opacity: 0.7;
  font-size: 0.9em;
}
</style>
