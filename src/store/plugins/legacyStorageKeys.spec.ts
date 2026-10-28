// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyStorageKeys } from './legacyStorageKeys';

describe('migrateLegacyStorageKeys', () => {
  beforeEach(() => localStorage.clear());

  it('copies every old-name key to the new name, keeping the old ones', () => {
    localStorage.setItem('habitica-streak:save:v5', '{"a":1}');
    localStorage.setItem('habitica-streak:theme:v1', 'minimalist');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem('streak-slayer:save:v5')).toBe('{"a":1}');
    expect(localStorage.getItem('streak-slayer:theme:v1')).toBe('minimalist');
    expect(localStorage.getItem('habitica-streak:save:v5')).toBe('{"a":1}');
  });

  it('does nothing once anything is stored under the new name', () => {
    localStorage.setItem('habitica-streak:save:v5', '{"a":1}');
    localStorage.setItem('habitica-streak:highscore:runs:v1', '[]');
    localStorage.setItem('streak-slayer:save:v5', '{"b":2}');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem('streak-slayer:save:v5')).toBe('{"b":2}');
    expect(localStorage.getItem('streak-slayer:highscore:runs:v1')).toBeNull();
  });

  it('leaves unrelated keys alone', () => {
    localStorage.setItem('other', 'x');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem('other')).toBe('x');
    expect(localStorage.length).toBe(1);
  });
});
