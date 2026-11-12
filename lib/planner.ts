/**
 * lib/planner.ts
 * ─────────────────────────────────────────────────────────────
 * Planificateur de journée — fonctions pures partagées client/serveur.
 *
 *  1. computeDurations : points (1–10) → durée de chaque tâche
 *     - proportional : la capacité de la journée (hors pause) est répartie
 *       au prorata des points entre les tâches sans durée manuelle.
 *     - perPoint     : durée = points × minutesPerPoint.
 *  2. planDay : place les tâches sur la journée.
 *     - les tâches épinglées (horaire fixé à la main) restent à leur place ;
 *     - les autres remplissent les créneaux libres dans l'ordre `position`,
 *       en se découpant autour de la pause déjeuner et des tâches épinglées.
 */

import type { UserSettings } from '@/types';

export type PlanSettings = Pick<
  UserSettings,
  | 'workdayStart'
  | 'workdayEnd'
  | 'lunchEnabled'
  | 'lunchStart'
  | 'lunchEnd'
  | 'durationMode'
  | 'minutesPerPoint'
>;

export interface PlanTask {
  id: string;
  points: number;
  position: number;
  manualDuration: number | null;
  startTime: string | null;
  pinned: boolean;
}

export interface Segment {
  start: number; // minutes depuis minuit
  end: number;
}

export interface PlannedSlot {
  id: string;
  startTime: string;
  durationMinutes: number;
  segments: Segment[];
  /** true si la tâche déborde après la fin de journée. */
  overflow: boolean;
}

const SLOT = 5; // granularité d'arrondi (minutes)
const MIN_DURATION = 15;

// ─── Helpers horaires ─────────────────────────────────────────

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const h = Math.floor(clamped / 60).toString().padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${r.toString().padStart(2, '0')}`;
}

/**
 * Parse une durée libre : "90" | "90m" | "45min" | "1h" | "1h30" | "1.5h"
 * Retourne null si illisible.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  const dec = s.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (dec) return Math.round(parseFloat(dec[1]) * 60);
  const hm = s.match(/^(\d+)\s*h\s*(\d+)\s*(?:m|min)?$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  const m = s.match(/^(\d+)\s*(?:m|min|mn)?$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function lunchInterval(s: PlanSettings): Segment | null {
  if (!s.lunchEnabled) return null;
  const start = toMinutes(s.lunchStart);
  const end = toMinutes(s.lunchEnd);
  return end > start ? { start, end } : null;
}

/** Minutes de travail disponibles dans la journée (pause déduite). */
export function dayCapacity(s: PlanSettings): number {
  const start = toMinutes(s.workdayStart);
  const end = toMinutes(s.workdayEnd);
  let capacity = Math.max(0, end - start);
  const lunch = lunchInterval(s);
  if (lunch) {
    const overlap = Math.max(0, Math.min(end, lunch.end) - Math.max(start, lunch.start));
    capacity -= overlap;
  }
  return capacity;
}

// ─── 1. Durées ────────────────────────────────────────────────

export function computeDurations(
  tasks: Pick<PlanTask, 'id' | 'points' | 'manualDuration'>[],
  s: PlanSettings,
): Map<string, number> {
  const result = new Map<string, number>();
  const auto = tasks.filter((t) => t.manualDuration == null);

  for (const t of tasks) {
    if (t.manualDuration != null) result.set(t.id, t.manualDuration);
  }

  if (s.durationMode === 'perPoint') {
    for (const t of auto) result.set(t.id, Math.max(SLOT, t.points * s.minutesPerPoint));
    return result;
  }

  if (auto.length === 0) return result;

  const manualTotal = tasks.reduce((sum, t) => sum + (t.manualDuration ?? 0), 0);
  const remaining = dayCapacity(s) - manualTotal;

  // Journée déjà pleine : on garde une durée minimale proportionnelle aux points.
  if (remaining < auto.length * MIN_DURATION) {
    for (const t of auto) result.set(t.id, Math.max(MIN_DURATION, t.points * SLOT));
    return result;
  }

  const totalPoints = auto.reduce((sum, t) => sum + t.points, 0);
  const raw = auto.map((t) => ({
    id: t.id,
    value: totalPoints > 0 ? (remaining * t.points) / totalPoints : remaining / auto.length,
  }));

  // Arrondi au créneau de 5 min par la méthode du plus fort reste,
  // pour que Σ(durées) == remaining (au créneau près).
  const slots = Math.floor(remaining / SLOT);
  const floored = raw.map((r) => ({ ...r, slots: Math.floor(r.value / SLOT) }));
  let leftover = slots - floored.reduce((sum, r) => sum + r.slots, 0);
  const byRemainder = [...floored].sort(
    (a, b) => (b.value / SLOT - b.slots) - (a.value / SLOT - a.slots),
  );
  for (const r of byRemainder) {
    if (leftover <= 0) break;
    r.slots += 1;
    leftover -= 1;
  }
  const extra = remaining - slots * SLOT; // reliquat < 5 min
  floored.forEach((r, i) => {
    const minutes = r.slots * SLOT + (i === floored.length - 1 ? extra : 0);
    result.set(r.id, Math.max(SLOT, minutes));
  });
  return result;
}

// ─── 2. Placement ─────────────────────────────────────────────

function subtractBusy(free: Segment[], busy: Segment): Segment[] {
  const out: Segment[] = [];
  for (const f of free) {
    if (busy.end <= f.start || busy.start >= f.end) {
      out.push(f);
      continue;
    }
    if (busy.start > f.start) out.push({ start: f.start, end: busy.start });
    if (busy.end < f.end) out.push({ start: busy.end, end: f.end });
  }
  return out;
}

export function planDay(tasks: PlanTask[], s: PlanSettings): Map<string, PlannedSlot> {
  const durations = computeDurations(tasks, s);
  const dayStart = toMinutes(s.workdayStart);
  const dayEnd = toMinutes(s.workdayEnd);
  const result = new Map<string, PlannedSlot>();

  // Temps libre : de début de journée à minuit, moins pause et tâches épinglées.
  let free: Segment[] = [{ start: dayStart, end: 24 * 60 }];
  const lunch = lunchInterval(s);
  if (lunch) free = subtractBusy(free, lunch);

  const pinned = tasks.filter((t) => t.pinned && t.startTime);
  for (const t of pinned) {
    const start = toMinutes(t.startTime!);
    const duration = durations.get(t.id) ?? 60;
    const seg = { start, end: start + duration };
    free = subtractBusy(free, seg);
    result.set(t.id, {
      id: t.id,
      startTime: fromMinutes(start),
      durationMinutes: duration,
      segments: [seg],
      overflow: seg.end > dayEnd,
    });
  }

  const flowing = tasks
    .filter((t) => !(t.pinned && t.startTime))
    .sort((a, b) => a.position - b.position);

  for (const t of flowing) {
    const duration = durations.get(t.id) ?? 60;
    let left = duration;
    const segments: Segment[] = [];
    while (left > 0 && free.length > 0) {
      const slot = free[0];
      const take = Math.min(left, slot.end - slot.start);
      const seg = { start: slot.start, end: slot.start + take };
      segments.push(seg);
      free = subtractBusy(free, seg);
      left -= take;
    }
    if (segments.length === 0) {
      // Plus de place avant minuit — cas extrême, on empile en fin de journée.
      segments.push({ start: dayEnd, end: dayEnd + duration });
    }
    result.set(t.id, {
      id: t.id,
      startTime: fromMinutes(segments[0].start),
      durationMinutes: duration,
      segments,
      overflow: segments[segments.length - 1].end > dayEnd,
    });
  }

  return result;
}

/** Applique le résultat de planDay à une liste de tâches (copie). */
export function applyPlan<T extends PlanTask & { durationMinutes: number }>(
  tasks: T[],
  s: PlanSettings,
): T[] {
  const plan = planDay(tasks, s);
  return tasks.map((t) => {
    const slot = plan.get(t.id);
    return slot
      ? { ...t, startTime: slot.startTime, durationMinutes: slot.durationMinutes }
      : t;
  });
}
