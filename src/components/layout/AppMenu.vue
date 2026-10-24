<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, Dices, Menu, Trophy, Wrench } from 'lucide-vue-next';
import { useEventChoice } from '../../composables/useEventChoice';
import { useDevBossArt } from '../../composables/useDevBossArt';
import { useItemDropQueue } from '../../composables/useItemDropQueue';
import { THEMES, useThemeStore } from '../../store/themeStore';
import type { Theme } from '../../store/themeStore';
import { useCharacterStore } from '../../store/characterStore';

// Top-right menu: High Scores and the theme picker. Picking a theme keeps the
// menu open so themes can be flipped back and forth; anything else, a tap
// outside, or Escape closes it.
const emit = defineEmits<{ 'high-scores': [] }>();

const themeStore = useThemeStore();
const characterStore = useCharacterStore();
const { enqueueDrops } = useItemDropQueue();
const { cycle: cycleBossArt } = useDevBossArt();
const { devReroll } = useEventChoice();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

// Temporary art trial: the items whose art is being tried out.
const DEV_ITEM_IDS = ['berserkers-war-axe', 'shadow-dagger', 'amethyst-scimitar', 'ember-staff', 'molten-battle-axe'];

function openHighScores() {
  open.value = false;
  emit('high-scores');
}

// Hands over the trial items through the normal drop flow, so each auto-equips
// or asks which item to replace (already-owned ones are skipped), and swaps the
// boss panel to the next trial boss art (the last tap restores the real art).
function devMode() {
  open.value = false;
  const items = DEV_ITEM_IDS.map((id) => characterStore.grantItem(id)).filter((item) => item !== null);
  if (items.length) enqueueDrops(items);
  cycleBossArt();
}

// Temporary test hook: opens the reroll picker without spending a level-up pick.
function openReroll() {
  open.value = false;
  devReroll.value = true;
}

function pickTheme(theme: Theme) {
  themeStore.setTheme(theme);
}

function closeOnOutsideTap(event: Event) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideTap);
  document.addEventListener('keydown', closeOnEscape);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideTap);
  document.removeEventListener('keydown', closeOnEscape);
});
</script>

<template>
  <div ref="root" class="app-menu">
    <button type="button" class="menu-button" aria-label="Menu" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
      <Menu :size="18" />
    </button>
    <div v-if="open" class="menu-panel" role="menu">
      <button type="button" class="menu-item" role="menuitem" @click="openHighScores"><Trophy :size="15" />High Scores</button>
      <div class="menu-divider" role="separator" />
      <span class="menu-label">Theme</span>
      <button
        v-for="option in THEMES"
        :key="option.id"
        type="button"
        class="menu-item"
        role="menuitemradio"
        :aria-checked="themeStore.theme === option.id"
        @click="pickTheme(option.id)"
      >
        <Check :size="15" class="tick" :class="{ on: themeStore.theme === option.id }" />{{ option.label }}
      </button>
      <div class="menu-divider" role="separator" />
      <button type="button" class="menu-item" role="menuitem" @click="devMode"><Wrench :size="15" />Dev mode</button>
      <button type="button" class="menu-item" role="menuitem" @click="openReroll"><Dices :size="15" />Reroll a skill</button>
    </div>
  </div>
</template>

<style scoped>
.app-menu {
  position: relative;
}

.menu-button {
  display: grid;
  place-items: center;
  padding: 0.35em 0.55em;
}

.menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 190px;
  padding: 0.35rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--text-h);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
}

.menu-item:hover {
  background: var(--accent-bg);
}

.menu-divider {
  height: 1px;
  margin: 0.35rem 0.25rem;
  background: var(--border);
}

.menu-label {
  display: block;
  padding: 0.3rem 0.65rem 0.2rem;
  color: var(--text);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tick {
  opacity: 0;
}

.tick.on {
  opacity: 1;
  color: var(--accent-solid);
}
</style>
