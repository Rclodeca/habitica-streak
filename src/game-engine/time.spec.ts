import { describe, expect, it } from 'vitest';
import { dailyPeriodKey, periodKeyFor, weeklyPeriodKey } from './time';

describe('dailyPeriodKey', () => {
  it('formats a UTC date as YYYY-MM-DD', () => {
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 0, 1)))).toBe('2024-01-01');
  });

  it('pads single-digit months and days', () => {
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 8, 5)))).toBe('2024-09-05');
  });

  it('uses the UTC calendar date, not local time-of-day', () => {
    // 23:59 UTC on Dec 31 should still be Dec 31 in UTC terms.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 11, 31, 23, 59)))).toBe('2024-12-31');
  });
});

describe('weeklyPeriodKey', () => {
  it('2024-01-01 is ISO week 2024-W01', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2024, 0, 1)))).toBe('2024-W01');
  });

  it('2023-01-01 is ISO week 2022-W52', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2023, 0, 1)))).toBe('2022-W52');
  });

  it('handles a mid-year date correctly (2024-06-15 -> 2024-W24)', () => {
    // 2024-06-15 is a Saturday; the ISO week containing it starts Monday 2024-06-10.
    expect(weeklyPeriodKey(new Date(Date.UTC(2024, 5, 15)))).toBe('2024-W24');
  });

  it('a Monday and the following Sunday fall in the same ISO week', () => {
    const monday = new Date(Date.UTC(2024, 0, 8)); // Monday
    const sunday = new Date(Date.UTC(2024, 0, 14)); // Sunday
    expect(weeklyPeriodKey(monday)).toBe(weeklyPeriodKey(sunday));
  });

  it('the following Monday rolls into the next ISO week', () => {
    const sunday = new Date(Date.UTC(2024, 0, 14));
    const nextMonday = new Date(Date.UTC(2024, 0, 15));
    expect(weeklyPeriodKey(sunday)).not.toBe(weeklyPeriodKey(nextMonday));
  });

  it('handles a year with 53 ISO weeks (2020-12-31 -> 2020-W53)', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2020, 11, 31)))).toBe('2020-W53');
  });
});

describe('periodKeyFor', () => {
  it('dispatches to dailyPeriodKey for "daily"', () => {
    const date = new Date(Date.UTC(2024, 0, 1));
    expect(periodKeyFor('daily', date)).toBe(dailyPeriodKey(date));
  });

  it('dispatches to weeklyPeriodKey for "weekly"', () => {
    const date = new Date(Date.UTC(2024, 0, 1));
    expect(periodKeyFor('weekly', date)).toBe(weeklyPeriodKey(date));
  });
});
