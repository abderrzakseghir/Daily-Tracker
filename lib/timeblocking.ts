/**
 * lib/timeblocking.ts
 * ─────────────────────────────────────────────────────────────
 * Algorithm and helpers for the Timeblocking / Jira planning feature.
 */

import type { PlannedJiraTicket } from '@/types';

// ─── Constants ────────────────────────────────────────────────

/** Start of the workday (inclusive). */
export const WORK_START_HOUR = 9;
/** Hard capacity limit (exclusive). Work stops here. */
export const WORK_END_HOUR = 17;
/** Maximum schedulable minutes per day: 8 h = 480 min. */
export const DAY_CAPACITY_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60;

/** Calendar display range — can extend past WORK_END_HOUR for overflow visibility. */
export const CALENDAR_START_HOUR = 9;
export const CALENDAR_END_HOUR = 19;
export const DISPLAY_HOURS = CALENDAR_END_HOUR - CALENDAR_START_HOUR; // 10

/** Pixel height per hour in the calendar grid. */
export const HOUR_PX = 64;

// ─── Duration helpers ─────────────────────────────────────────

/**
 * Maps an importance score (1–10) to a base duration in minutes.
 * Formula: importance × 12, clamped to [5, 120].
 * Examples: 1 → 12 min | 5 → 60 min | 10 → 120 min
 */
export function importanceToDuration(importance: number): number {
  return Math.max(5, Math.min(120, Math.round(importance * 12)));
}

/**
 * Parses flexible duration strings to minutes.
 * Accepted formats: "90" | "90m" | "1h30" | "1h30m" | "1.5h" | "2h"
 * Returns null if the string cannot be parsed.
 */
export function parseDurationInput(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // Decimal hours: "1.5h", "2.5hr", "0.5hours"
  const decHours = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|ours?)?$/);
  if (decHours) return Math.round(parseFloat(decHours[1]) * 60);

  // "1h30m", "1h30", "2h15min"
  const hm = s.match(/^(\d+)\s*h(?:r|rs)?\s*(\d+)?\s*(?:m(?:in(?:utes?)?)?)?$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2] ?? '0', 10);

  // Pure minutes: "90", "90m", "45min"
  const mins = s.match(/^(\d+)\s*(?:m(?:in(?:utes?)?)?)?$/);
  if (mins) return parseInt(mins[1], 10);

  return null;
}

/** Formats total minutes since midnight as "HH:MM". */
export function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Formats a duration in minutes to a human-readable string ("1h30", "45min"). */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}

// ─── Core algorithm ───────────────────────────────────────────

/**
 * autoScheduleTickets — schedules a list of tickets for a single work day.
 *
 * Algorithm (prorata de l'importance) :
 *  A. tempsManuelTotal = Σ(ticket.durationMinutes) for manually-set tickets.
 *  B. tempsRestant = DAY_CAPACITY_MINUTES − tempsManuelTotal.
 *     Throws if tempsRestant ≤ 0 (day already over capacity).
 *  C. totalImportanceAuto = Σ(ticket.importance) for auto tickets.
 *  D. effectiveDuration_i = tempsRestant × (importance_i / totalImportanceAuto).
 *  E. Largest-remainder rounding ensures Σ(auto durations) == tempsRestant exactly.
 *  F. Sequential start times from WORK_START_HOUR:00.
 *
 * Returns a new array — original tickets are not mutated.
 * Throws an Error with a French message when the manual durations alone fill the day.
 */
export function autoScheduleTickets(
  tickets: PlannedJiraTicket[],
): PlannedJiraTicket[] {
  if (tickets.length === 0) return [];

  // ── Step A: total of manually-set durations ──────────────────────────────
  const tempsManuelTotal = tickets
    .filter((t) => t.durationMinutes != null)
    .reduce((sum, t) => sum + t.durationMinutes!, 0);

  // ── Step B: remaining time available for auto-scheduled tickets ───────────
  const tempsRestant = DAY_CAPACITY_MINUTES - tempsManuelTotal;
  if (tempsRestant <= 0) {
    throw new Error(
      `Journée déjà pleine : les durées manuelles totalisent ${tempsManuelTotal} min` +
        ` (capacité : ${DAY_CAPACITY_MINUTES} min). Réduisez certaines durées manuelles.`,
    );
  }

  // ── Step C: importance sum for auto tickets ───────────────────────────────
  const autoTickets = tickets.filter((t) => t.durationMinutes == null);
  const totalImportanceAuto = autoTickets.reduce((sum, t) => sum + t.importance, 0);

  // ── Step D: raw proportional durations ───────────────────────────────────
  // Fall back to equal distribution when all importances are 0.
  const rawByKey = new Map<string, number>();
  for (const t of autoTickets) {
    rawByKey.set(
      t.key,
      totalImportanceAuto > 0
        ? tempsRestant * (t.importance / totalImportanceAuto)
        : tempsRestant / autoTickets.length,
    );
  }

  // ── Step E: largest-remainder rounding → Σ(auto) == tempsRestant exactly ─
  // floor() guarantees sumFloored ≤ tempsRestant (no artificial minimum here).
  const flooredByKey = new Map<string, number>();
  let sumFloored = 0;
  for (const [key, raw] of rawByKey) {
    const f = Math.floor(raw);
    flooredByKey.set(key, f);
    sumFloored += f;
  }

  // Distribute the leftover minutes to tickets with the highest fractional part.
  let remainderMinutes = tempsRestant - sumFloored; // always >= 0
  const sortedByFrac = [...autoTickets].sort((a, b) => {
    const fracA = (rawByKey.get(a.key) ?? 0) % 1;
    const fracB = (rawByKey.get(b.key) ?? 0) % 1;
    return fracB - fracA;
  });
  const finalByKey = new Map(flooredByKey);
  for (const t of sortedByFrac) {
    if (remainderMinutes <= 0) break;
    finalByKey.set(t.key, (finalByKey.get(t.key) ?? 0) + 1);
    remainderMinutes--;
  }

  // ── Step F: sequential start times from 09:00 ────────────────────────────
  let cursor = WORK_START_HOUR * 60; // minutes from midnight

  return tickets.map((t) => {
    const computed =
      t.durationMinutes != null
        ? t.durationMinutes
        : (finalByKey.get(t.key) ?? 0);
    const scheduled: PlannedJiraTicket = {
      ...t,
      computedDurationMinutes: computed,
      scheduledStartTime: minutesToTimeString(cursor),
    };
    cursor += computed;
    return scheduled;
  });
}

// ─── Calendar positioning helpers ────────────────────────────

/** Returns the CSS top offset (px) for a "HH:MM" start time relative to CALENDAR_START_HOUR. */
export function timeToTopPx(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const minutesFromStart = h * 60 + m - CALENDAR_START_HOUR * 60;
  return (minutesFromStart * HOUR_PX) / 60;
}

/** Returns the CSS height (px) for a given duration in minutes (min 18px for readability). */
export function durationToHeightPx(minutes: number): number {
  return Math.max(18, (minutes * HOUR_PX) / 60);
}

// ─── Week utilities ───────────────────────────────────────────

/**
 * Returns an array of 7 ISO date strings (Mon–Sun) for the given week offset
 * from the current week (0 = current, -1 = last week, +1 = next week).
 */
export function getWeekDays(weekOffset = 0): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Returns { day: "Lun", num: "17", isToday: true } for a date string. */
export function formatDateLabel(dateStr: string): {
  day: string;
  num: string;
  isToday: boolean;
} {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date().toISOString().split('T')[0];
  const dow = d.getDay(); // 0 = Sun
  return {
    day: DAY_LABELS_FR[dow === 0 ? 6 : dow - 1],
    num: d.getDate().toString(),
    isToday: dateStr === today,
  };
}

// ─── Colour helpers ───────────────────────────────────────────

const TICKET_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50 dark:bg-blue-950' },
  { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50 dark:bg-violet-950' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-950' },
  { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50 dark:bg-amber-950' },
  { bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50 dark:bg-rose-950' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-950' },
  { bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-50 dark:bg-pink-950' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50 dark:bg-indigo-950' },
  { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50 dark:bg-teal-950' },
  { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50 dark:bg-orange-950' },
] as const;

export function getTicketColor(projectKey: string) {
  let hash = 0;
  for (const ch of projectKey) {
    hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  }
  return TICKET_COLORS[hash % TICKET_COLORS.length];
}

/** Tailwind class for the importance badge colour. */
export function importanceBadgeClass(importance: number): string {
  if (importance >= 9) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400';
  if (importance >= 7) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
  if (importance >= 4) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
}

/** Hex colour for the importance slider thumb. */
export function importanceHex(importance: number): string {
  if (importance >= 9) return '#EF4444';
  if (importance >= 7) return '#F59E0B';
  if (importance >= 4) return '#3B82F6';
  return '#10B981';
}
