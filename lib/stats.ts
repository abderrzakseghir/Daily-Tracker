import { addDaysISO, isoWeekday, todayISO } from './dates';
import { CATEGORIES, type Category, type DayMeta, type Task } from '@/types';

/** Jours ouvrés consécutifs validés (aujourd'hui non validé ne casse pas la série). */
export function computeStreak(days: DayMeta[], workdays: number[]): number {
  const validated = new Set(days.filter((d) => d.validated).map((d) => d.date));
  let date = todayISO();
  let streak = 0;
  if (!validated.has(date)) date = addDaysISO(date, -1);
  for (let i = 0; i < 400; i++) {
    if (!workdays.includes(isoWeekday(date))) {
      date = addDaysISO(date, -1);
      continue;
    }
    if (!validated.has(date)) break;
    streak++;
    date = addDaysISO(date, -1);
  }
  return streak;
}

export function emptyByCategory(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
}

export interface DaySummary {
  date: string;
  minutes: number;
  doneMinutes: number;
  tasks: number;
  done: number;
  points: number;
  donePoints: number;
  focusMinutes: number;
  jiraMinutes: number;
  validated: boolean;
  mood: number | null;
  energy: number | null;
  byCategory: Record<Category, number>;
  /** Minutes des tâches terminées, par catégorie. */
  doneByCategory: Record<Category, number>;
}

export function summarizeDays(dates: string[], metas: DayMeta[], tasks: Task[]): DaySummary[] {
  const metaByDate = new Map(metas.map((m) => [m.date, m]));
  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) tasksByDate.set(t.date, [...(tasksByDate.get(t.date) ?? []), t]);

  return dates.map((date) => {
    const list = tasksByDate.get(date) ?? [];
    const meta = metaByDate.get(date);
    const byCategory = emptyByCategory();
    const doneByCategory = emptyByCategory();
    let minutes = 0, doneMinutes = 0, done = 0, points = 0, donePoints = 0, focus = 0, jira = 0;
    for (const t of list) {
      minutes += t.durationMinutes;
      points += t.points;
      focus += t.actualMinutes;
      byCategory[t.category] += t.durationMinutes;
      if (t.status === 'done') {
        done++;
        doneMinutes += t.durationMinutes;
        donePoints += t.points;
        doneByCategory[t.category] += t.durationMinutes;
        if (t.jiraKey) jira += t.durationMinutes;
      }
    }
    return {
      date,
      minutes,
      doneMinutes,
      tasks: list.length,
      done,
      points,
      donePoints,
      focusMinutes: focus,
      jiraMinutes: jira,
      validated: meta?.validated ?? false,
      mood: meta?.mood ?? null,
      energy: meta?.energy ?? null,
      byCategory,
      doneByCategory,
    };
  });
}

export const MOODS = [
  { value: 1, emoji: '😫', label: 'Difficile' },
  { value: 2, emoji: '😕', label: 'Bof' },
  { value: 3, emoji: '😐', label: 'Correct' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '🤩', label: 'Excellent' },
];

export const ENERGIES = [
  { value: 1, emoji: '🪫', label: 'Épuisé' },
  { value: 2, emoji: '😴', label: 'Fatigué' },
  { value: 3, emoji: '🔋', label: 'Normal' },
  { value: 4, emoji: '⚡', label: 'En forme' },
  { value: 5, emoji: '🚀', label: 'Au top' },
];
