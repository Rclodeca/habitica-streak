import type { Period } from './types';

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const ROLLOVER_HOUR = 3;

/**
 * Returns the UTC-midnight `Date` for the "business day" `date` belongs to,
 * where a day runs from 3am Pacific to 3am Pacific the next day rather than
 * midnight-to-midnight — so staying up past midnight doesn't roll the day
 * over early. Uses `Intl` (not a fixed UTC offset) so PST/PDT transitions
 * are handled automatically. Shared by `dailyPeriodKey` and
 * `weeklyPeriodKey` so both period types roll over at the same instant.
 */
function pacificBusinessDay(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const businessDay = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  if (get('hour') < ROLLOVER_HOUR) {
    businessDay.setUTCDate(businessDay.getUTCDate() - 1);
  }
  return businessDay;
}

/**
 * Returns a `YYYY-MM-DD` key for the given date's Pacific business day (see
 * `pacificBusinessDay` — days run 3am-to-3am Pacific, not midnight-to-midnight).
 */
export function dailyPeriodKey(date: Date): string {
  const d = pacificBusinessDay(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns an ISO 8601 week key like `YYYY-Www` for the given date's Pacific
 * business day (Monday-start weeks, week 1 is the week containing the
 * year's first Thursday).
 *
 * Implementation uses the standard "nearest Thursday" ISO week algorithm:
 * shift the date to the Thursday of its own week, then compare against the
 * first Thursday of that Thursday's year.
 */
export function weeklyPeriodKey(date: Date): string {
  const d = pacificBusinessDay(date);

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
