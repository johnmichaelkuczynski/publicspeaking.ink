import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Current activity streak in days, derived from recent-activity timestamps.
 * Counts back consecutively from today (or yesterday, so a streak isn't lost
 * before the day is over) for each calendar day that has at least one entry.
 */
export function computeStreak(timestamps: Array<string | Date>): number {
  const days = new Set(
    timestamps.map((t) => dayKey(t instanceof Date ? t : new Date(t))),
  );
  if (days.size === 0) return 0;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (!days.has(dayKey(today)) && !days.has(dayKey(yesterday))) return 0;

  let streak = 0;
  const cursor = new Date(today);
  if (!days.has(dayKey(today))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
