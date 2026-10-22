// @vitest-environment jsdom
//
// Needs a real localStorage and document, matching the convention used by
// `store/highScoreStore.spec.ts`.

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, useThemeStore } from './themeStore';

const STORAGE_KEY = 'habitica-streak:theme:v1';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    setActivePinia(createPinia());
  });

  it('defaults to Ashen with no saved choice', () => {
    expect(useThemeStore().theme).toBe('ashen');
  });

  it('restores a saved choice', () => {
    localStorage.setItem(STORAGE_KEY, 'minimalist');
    expect(useThemeStore().theme).toBe('minimalist');
  });

  it('falls back to the default for an unknown saved value', () => {
    localStorage.setItem(STORAGE_KEY, 'neon');
    expect(useThemeStore().theme).toBe('ashen');
  });

  it('setTheme persists the choice and stamps it on <html>', () => {
    const store = useThemeStore();
    store.setTheme('minimalist');
    expect(store.theme).toBe('minimalist');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('minimalist');
    expect(document.documentElement.dataset.theme).toBe('minimalist');
  });

  it('applyTheme stamps the theme without persisting it', () => {
    applyTheme('ashen');
    expect(document.documentElement.dataset.theme).toBe('ashen');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
