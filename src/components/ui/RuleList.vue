<script lang="ts">
import type { Component } from 'vue';

// A few one-line rules (icon, keyword, line) that explain a mechanic in a
// handful of words — NewHeroScreen and QuestUnlockPopup. `tone` only picks
// the icon colour.
export interface Rule {
  icon: Component;
  tone: 'accent' | 'solid' | 'danger';
  title: string;
  text: string;
}
</script>

<script setup lang="ts">
defineProps<{ rules: readonly Rule[] }>();
</script>

<template>
  <ul class="rule-list">
    <li v-for="rule in rules" :key="rule.title" :class="rule.tone">
      <component :is="rule.icon" class="rule-icon" :size="14" :stroke-width="2" />
      <b>{{ rule.title }}</b>
      <span>{{ rule.text }}</span>
    </li>
  </ul>
</template>

<style scoped>
.rule-list {
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
  text-align: left;
}

.rule-list li {
  display: grid;
  grid-template-columns: 22px 4rem 1fr;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.1rem;
  border-bottom: 1px solid var(--border);
}

.rule-list b {
  color: var(--text-h);
  font-size: 0.8rem;
  font-weight: 600;
}

.rule-list span {
  color: var(--text);
  font-size: 0.9rem;
}

.accent .rule-icon {
  color: var(--accent);
}

.solid .rule-icon {
  color: var(--accent-solid);
}

.danger .rule-icon {
  color: var(--damage-color);
}
</style>
