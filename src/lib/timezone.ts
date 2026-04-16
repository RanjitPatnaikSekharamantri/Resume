"use client";

const TZ_STORAGE_KEY = "ai-career-os-timezone";

/**
 * Detect the user's timezone using the browser's Intl API.
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Get the user's preferred timezone.
 * Priority: localStorage override → Intl detection → UTC fallback.
 */
export function getUserTimezone(): string {
  if (typeof window === "undefined") return "UTC";

  const stored = localStorage.getItem(TZ_STORAGE_KEY);
  if (stored && stored !== "auto") return stored;

  return detectTimezone();
}

/**
 * Save a timezone preference. Pass "auto" to use auto-detection.
 */
export function setUserTimezone(tz: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TZ_STORAGE_KEY, tz);
}

/**
 * Format a date/timestamp to the user's local timezone.
 * Uses consistent short date format: "Apr 15, 2026"
 */
export function formatToUserTime(
  date: Date | string | number,
  options?: { includeTime?: boolean; relative?: boolean }
): string {
  const tz = getUserTimezone();
  const d = new Date(date);

  if (isNaN(d.getTime())) return "—";

  if (options?.relative) {
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
  }

  if (options?.includeTime) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    }).format(d);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(d);
}

/**
 * Format a date for short display (e.g. dashboard reminder): "Apr 15"
 */
export function formatShortDate(date: Date | string | number): string {
  const tz = getUserTimezone();
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

/**
 * Common timezone options for the manual override picker.
 */
export const TIMEZONE_OPTIONS = [
  "auto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
];

export function getTimezoneLabel(tz: string): string {
  if (tz === "auto") return "Auto-detect";
  return tz.replace(/_/g, " ").replace(/\//g, " / ");
}
