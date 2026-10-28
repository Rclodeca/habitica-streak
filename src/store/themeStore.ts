// Visual theme preference. A UI setting, not game state: it lives in its own
// localStorage key (like highScoreStore's) so it survives death resets and
// any SaveState schema bump. The active theme is stamped on
// `<html data-theme="...">`, which is what every theme's CSS keys off — see
// assets/scss/themes/.

import { defineStore } from 'pinia';

export type Theme = 'ashen' | 'minimalist';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'ashen', label: 'Ashen' },
  { id: 'minimalist', label: 'Minimalist' },
];

export const STORAGE_KEY = 'habitica-streak:theme:v1';
const DEFAULT_THEME: Theme = 'ashen';

function loadTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === saved) ? (saved as Theme) : DEFAULT_THEME;
}

/** Puts `theme` on `<html data-theme>` without persisting it (main.ts calls this once before mount). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ theme: loadTheme() }),
  actions: {
    setTheme(theme: Theme) {
      this.theme = theme;
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
    },
  },
});
