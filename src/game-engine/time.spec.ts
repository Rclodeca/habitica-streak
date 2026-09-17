import { describe, expect, it } from 'vitest';
import { dailyPeriodKey, periodKeyFor, weeklyPeriodKey } from './time';

describe('dailyPeriodKey', () => {
  it('formats a date as YYYY-MM-DD using its Pacific business day', () => {
    // 20:00 UTC is safely mid-afternoon Pacific, well past the 3am rollover.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 0, 1, 20)))).toBe('2024-01-01');
  });

  it('pads single-digit months and days', () => {
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 8, 5, 20)))).toBe('2024-09-05');
  });

  it('treats times before 3am Pacific as still belonging to the previous day (winter/PST)', () => {
    // 2024-01-15T10:59Z is 2024-01-15 02:59 PST (UTC-8) — one minute before rollover.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 0, 15, 10, 59)))).toBe('2024-01-14');
  });

  it('rolls into the new day at exactly 3am Pacific (winter/PST)', () => {
    // 2024-01-15T11:00Z is 2024-01-15 03:00 PST exactly.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 0, 15, 11, 0)))).toBe('2024-01-15');
  });

  it('treats times before 3am Pacific as still belonging to the previous day (summer/PDT)', () => {
    // 2024-07-15T09:59Z is 2024-07-15 02:59 PDT (UTC-7) — one minute before rollover.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 6, 15, 9, 59)))).toBe('2024-07-14');
  });

  it('rolls into the new day at exactly 3am Pacific (summer/PDT)', () => {
    // 2024-07-15T10:00Z is 2024-07-15 03:00 PDT exactly.
    expect(dailyPeriodKey(new Date(Date.UTC(2024, 6, 15, 10, 0)))).toBe('2024-07-15');
  });
});

describe('weeklyPeriodKey', () => {
  it('2024-01-01 is ISO week 2024-W01', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2024, 0, 1, 20)))).toBe('2024-W01');
  });

  it('2023-01-01 is ISO week 2022-W52', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2023, 0, 1, 20)))).toBe('2022-W52');
  });

  it('handles a mid-year date correctly (2024-06-15 -> 2024-W24)', () => {
    // 2024-06-15 is a Saturday; the ISO week containing it starts Monday 2024-06-10.
    expect(weeklyPeriodKey(new Date(Date.UTC(2024, 5, 15, 20)))).toBe('2024-W24');
  });

  it('a Monday and the following Sunday fall in the same ISO week', () => {
    const monday = new Date(Date.UTC(2024, 0, 8, 20));
    const sunday = new Date(Date.UTC(2024, 0, 14, 20));
    expect(weeklyPeriodKey(monday)).toBe(weeklyPeriodKey(sunday));
  });

  it('the following Monday rolls into the next ISO week', () => {
    const sunday = new Date(Date.UTC(2024, 0, 14, 20));
    const nextMonday = new Date(Date.UTC(2024, 0, 15, 20));
    expect(weeklyPeriodKey(sunday)).not.toBe(weeklyPeriodKey(nextMonday));
  });

  it('handles a year with 53 ISO weeks (2020-12-31 -> 2020-W53)', () => {
    expect(weeklyPeriodKey(new Date(Date.UTC(2020, 11, 31, 20)))).toBe('2020-W53');
  });

  it('rolls into the next ISO week at the same 3am Pacific boundary as dailyPeriodKey', () => {
    // Monday 2024-01-15T10:59Z is Sunday 2024-01-14 02:59 PST — still the prior week.
    const beforeRollover = new Date(Date.UTC(2024, 0, 15, 10, 59));
    // Monday 2024-01-15T11:00Z is Monday 2024-01-15 03:00 PST exactly — the new week.
    const atRollover = new Date(Date.UTC(2024, 0, 15, 11, 0));
    expect(weeklyPeriodKey(beforeRollover)).not.toBe(weeklyPeriodKey(atRollover));
  });
});

describe('periodKeyFor', () => {
  it('dispatches to dailyPeriodKey for "daily"', () => {
    const date = new Date(Date.UTC(2024, 0, 1, 20));
    expect(periodKeyFor('daily', date)).toBe(dailyPeriodKey(date));
  });

  it('dispatches to weeklyPeriodKey for "weekly"', () => {
    const date = new Date(Date.UTC(2024, 0, 1, 20));
    expect(periodKeyFor('weekly', date)).toBe(weeklyPeriodKey(date));
  });
});
