<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Check, Download, Menu, Trophy, Upload } from 'lucide-vue-next';
import { exportSaveFile } from '../../composables/useSaveFileTransfer';
import { applySaveFile, readSaveFile } from '../../store/saveFile';
import type { SaveFile, SaveFileSummary } from '../../store/saveFile';
import { THEMES, useThemeStore } from '../../store/themeStore';
import type { Theme } from '../../store/themeStore';
import Modal from '../ui/Modal.vue';

// Top-right menu: High Scores, save export/import, and the theme picker.
// Picking a theme keeps the menu open so themes can be flipped back and
// forth; anything else, a tap outside, or Escape closes it.
const emit = defineEmits<{ 'high-scores': [] }>();

const themeStore = useThemeStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function openHighScores() {
  open.value = false;
  emit('high-scores');
}

function pickTheme(theme: Theme) {
  themeStore.setTheme(theme);
}

// Export/import: export hands the file to the share sheet; import reads a
// picked file and asks before replacing the run, then reloads so every store
// rehydrates from it.
const TOAST_LIFETIME_MS = 2500;
const toast = ref<{ text: string; bad: boolean } | null>(null);
let toastTimeout: ReturnType<typeof setTimeout> | undefined;

function showToast(text: string, bad = false) {
  toast.value = { text, bad };
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.value = null;
  }, TOAST_LIFETIME_MS);
}

async function exportSave() {
  open.value = false;
  if (await exportSaveFile()) showToast('Save exported');
}

const fileInput = ref<HTMLInputElement | null>(null);
const pending = ref<{ file: SaveFile; summary: SaveFileSummary } | null>(null);

function pickImport() {
  open.value = false;
  if (!fileInput.value) return;
  fileInput.value.value = ''; // so picking the same file again still fires change
  fileInput.value.click();
}

async function onFilePicked() {
  const picked = fileInput.value?.files?.[0];
  if (!picked) return;
  const result = readSaveFile(await picked.text());
  if (result) pending.value = result;
  else showToast('Not a save file', true);
}

const pendingWho = computed(() => {
  const summary = pending.value?.summary;
  if (!summary) return '';
  const rest = `at Boss ${summary.bossIndex}`;
  return summary.heroName ? `${summary.heroName}, level ${summary.level}, ${rest}` : `Level ${summary.level}, ${rest}`;
});

const pendingDate = computed(() => {
  const exportedAt = pending.value?.summary.exportedAt;
  return exportedAt ? new Date(exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
});

function replaceRun() {
  if (!pending.value) return;
  applySaveFile(pending.value.file);
  window.location.reload();
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
  clearTimeout(toastTimeout);
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
      <span class="menu-label">Save</span>
      <button type="button" class="menu-item" role="menuitem" @click="exportSave"><Upload :size="15" />Export</button>
      <button type="button" class="menu-item" role="menuitem" @click="pickImport"><Download :size="15" />Import</button>
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
    </div>
    <input ref="fileInput" type="file" class="file-input" tabindex="-1" aria-hidden="true" @change="onFilePicked" />
  </div>

  <Modal :model-value="pending !== null" title="Replace run?" max-width="380px" @update:model-value="pending = null">
    <p class="import-who">{{ pendingWho }}</p>
    <p class="import-note">Exported {{ pendingDate }}. Your current run and high scores are replaced.</p>
    <div class="import-actions">
      <button type="button" class="cancel-button" @click="pending = null">Cancel</button>
      <button type="button" class="ok-button" @click="replaceRun">Replace</button>
    </div>
  </Modal>

  <Teleport to="body">
    <div v-if="toast" class="save-toast" :class="{ bad: toast.bad }" role="status">{{ toast.text }}</div>
  </Teleport>
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

.file-input {
  display: none;
}

.import-who {
  margin: 0 0 0.4rem;
  color: var(--text-h);
  font-weight: 600;
  text-align: center;
}

.import-note {
  margin: 0;
  color: var(--text);
  font-size: 0.85rem;
  text-align: center;
}

.import-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-top: 1.1rem;
}

.import-actions button {
  min-height: 44px;
}

.import-actions .ok-button {
  background: color-mix(in srgb, var(--damage-color) 18%, transparent);
  border-color: color-mix(in srgb, var(--damage-color) 50%, transparent);
  color: var(--text-h);
  font-weight: 600;
}

.save-toast {
  position: fixed;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  /* Centred by its own width: left: 50% alone caps it at half the screen. */
  width: max-content;
  max-width: calc(100vw - 2rem);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  box-shadow: var(--shadow);
  font-weight: 600;
  z-index: 1000;
  pointer-events: none;
}

.save-toast.bad {
  border-color: var(--damage-color);
}
</style>
