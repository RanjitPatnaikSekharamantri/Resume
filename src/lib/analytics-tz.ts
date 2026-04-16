import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { startOfWeek, subDays, subWeeks, format, isSameDay } from "date-fns";

/**
 * Get a YYYY-MM-DD day key for a UTC date in the user's timezone.
 * This is the core function for timezone-correct grouping.
 */
export function getUserDayKey(date: Date | string, timeZone: string): string {
  try {
    return formatInTimeZone(new Date(date), timeZone, "yyyy-MM-dd");
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

/**
 * Get the start-of-week (Sunday) for a UTC date in the user's timezone.
 * Returns as a formatted label "MMM d".
 */
export function getUserWeekStart(date: Date | string, timeZone: string): { key: string; label: string } {
  try {
    const zoned = toZonedTime(new Date(date), timeZone);
    const weekStart = startOfWeek(zoned, { weekStartsOn: 0 });
    return {
      key: format(weekStart, "yyyy-MM-dd"),
      label: format(weekStart, "MMM d"),
    };
  } catch {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  }
}

/**
 * Get "today" in user's timezone as YYYY-MM-DD.
 */
export function getUserToday(timeZone: string): string {
  return getUserDayKey(new Date(), timeZone);
}

/**
 * Calculate daily streak: consecutive days (including today or yesterday)
 * where at least one application was created.
 */
export function calculateStreak(
  createdDates: Date[],
  timeZone: string
): number {
  if (createdDates.length === 0) return 0;

  const dayKeys = new Set(createdDates.map((d) => getUserDayKey(d, timeZone)));
  const today = getUserToday(timeZone);

  let streak = 0;
  let checkDay = today;

  if (!dayKeys.has(checkDay)) {
    checkDay = getPreviousDay(checkDay);
  }

  while (dayKeys.has(checkDay)) {
    streak++;
    checkDay = getPreviousDay(checkDay);
  }

  return streak;
}

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Build weekly activity data for the last N weeks, grouped by user timezone.
 */
export function buildWeeklyActivity(
  createdDates: Date[],
  timeZone: string,
  weeks = 12
): { name: string; applications: number }[] {
  const weekMap = new Map<string, { label: string; count: number }>();

  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = subWeeks(now, i);
    const { key, label } = getUserWeekStart(d, timeZone);
    if (!weekMap.has(key)) {
      weekMap.set(key, { label, count: 0 });
    }
  }

  for (const date of createdDates) {
    const { key } = getUserWeekStart(date, timeZone);
    const entry = weekMap.get(key);
    if (entry) entry.count++;
  }

  return [...weekMap.values()].map((v) => ({
    name: v.label,
    applications: v.count,
  }));
}

/**
 * Count this-week applications using user timezone week boundary.
 */
export function getThisWeekCount(
  createdDates: Date[],
  timeZone: string
): number {
  const { key: thisWeekKey } = getUserWeekStart(new Date(), timeZone);
  return createdDates.filter((d) => {
    const { key } = getUserWeekStart(d, timeZone);
    return key === thisWeekKey;
  }).length;
}
