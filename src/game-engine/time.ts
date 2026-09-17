import type { Period } from './types';

/**
 * Returns a `YYYY-MM-DD` key for the given date, using its UTC calendar date.
 */
export function dailyPeriodKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns an ISO 8601 week key like `YYYY-Www` for the given date (UTC-based,
 * Monday-start weeks, week 1 is the week containing the year's first Thursday).
 *
 * Implementation uses the standard "nearest Thursday" ISO week algorithm:
 * shift the date to the Thursday of its own week, then compare against the
 * first Thursday of that Thursday's year.
 */
export function weeklyPeriodKey(date: Date): string {
  // Normalize to a UTC midnight date to avoid time-of-day affecting day math.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // ISO day number: Monday = 0 ... Sunday = 6.
  const isoDayNum = (d.getUTCDay() + 6) % 7;
  // Move to the Thursday of the same ISO week.
  d.setUTCDate(d.getUTCDate() - isoDayNum + 3);

  // The ISO year is the year of that Thursday.
  const isoYear = d.getUTCFullYear();

  // Find the first Thursday of the ISO year (i.e. the Thursday of week 1).
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstIsoDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDayNum + 3);

  const weekNumber =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const week = String(weekNumber).padStart(2, '0');
  return `${isoYear}-W${week}`;
}

/**
 * Dispatches to the correct period-key function based on `period`.
 */
export function periodKeyFor(period: Period, date: Date): string {
  return period === 'daily' ? dailyPeriodKey(date) : weeklyPeriodKey(date);
}
