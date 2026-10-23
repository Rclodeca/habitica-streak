// Weekday labels for set-day skills, Monday first (index = dayOfWeekIndex).

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** "Every day" for a plain daily, otherwise "1 day" / "N days". */
export function dayCountLabel(days: number[] | undefined): string {
  if (!days || days.length === 7) return 'Every day';
  return days.length === 1 ? '1 day' : `${days.length} days`;
}
