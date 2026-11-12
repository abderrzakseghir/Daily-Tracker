'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig, type ScopedMutator } from 'swr';
import { api, fetcher } from './api';
import { applyPlan } from '@/lib/planner';
import { toast } from '@/lib/store';
import type {
  DayData,
  DayMeta,
  JiraIssue,
  JiraProject,
  Task,
  TaskInput,
  TaskPatch,
  TaskTemplate,
  User,
  UserSettings,
} from '@/types';

/**
 * Couche de données client :
 *  - lecture via SWR (cache partagé `swrCache`, voir app/providers.tsx) ;
 *  - écritures optimistes : le cache est modifié et re-planifié instantanément,
 *    puis remplacé par la réponse du serveur (source de vérité).
 */

export interface RangeData {
  days: DayMeta[];
  tasks: Task[];
}

/** Cache SWR partagé, itérable pour mettre à jour toutes les périodes chargées. */
export const swrCache = new Map<string, any>();

/**
 * Le `mutate` importé de 'swr' vise le cache par défaut, pas notre provider :
 * on récupère celui lié au provider via <SWRBridge /> (monté dans Providers).
 */
let globalMutate: ScopedMutator;

export function SWRBridge() {
  globalMutate = useSWRConfig().mutate;
  return null;
}

const rangeKey = (from: string, to: string) => `/api/days?from=${from}&to=${to}`;

function parseRangeKey(key: string): { from: string; to: string } | null {
  const m = key.match(/^\/api\/days\?from=(\d{4}-\d{2}-\d{2})&to=(\d{4}-\d{2}-\d{2})$/);
  return m ? { from: m[1], to: m[2] } : null;
}

export const emptyMeta = (date: string): DayMeta => ({
  date,
  blockers: '',
  notes: '',
  mood: null,
  energy: null,
  validated: false,
  validatedAt: null,
});

// ─── Lecture ──────────────────────────────────────────────────

export function useMe() {
  return useSWR<User>('/api/me', fetcher, { revalidateOnFocus: false });
}

export function useRange(from: string | null, to: string | null) {
  return useSWR<RangeData>(from && to ? rangeKey(from, to) : null, fetcher, {
    keepPreviousData: true,
  });
}

/** Métadonnées seules (validation, humeur) — pour les séries sur de longues périodes. */
export function useDayMetas(from: string | null, to: string | null) {
  return useSWR<RangeData>(from && to ? `${rangeKey(from, to)}&meta=1` : null, fetcher);
}

export function useDay(date: string) {
  const { data, error, isLoading } = useRange(date, date);
  // Référence stable tant que les données ne changent pas : les composants
  // qui dépendent de `day` dans un useEffect ne doivent pas boucler.
  const day = useMemo<DayData | undefined>(
    () =>
      data
        ? {
            meta: data.days.find((d) => d.date === date) ?? emptyMeta(date),
            tasks: data.tasks.filter((t) => t.date === date),
          }
        : undefined,
    [data, date],
  );
  return { day, error, isLoading };
}

export function useTemplates() {
  return useSWR<TaskTemplate[]>('/api/templates', fetcher);
}

export function useJiraProjects(enabled: boolean) {
  return useSWR<JiraProject[]>(enabled ? '/api/jira/projects' : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  });
}

export function useJiraIssues(enabled: boolean, q: string, scope: 'mine' | 'all') {
  const params = new URLSearchParams({ q, scope });
  return useSWR<JiraIssue[]>(enabled ? `/api/jira/issues?${params}` : null, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

// ─── Mises à jour du cache ────────────────────────────────────

type RangeUpdater = (data: RangeData, from: string, to: string) => RangeData;

function updateRanges(fn: RangeUpdater) {
  for (const key of Array.from(swrCache.keys())) {
    const range = parseRangeKey(key);
    if (!range) continue;
    globalMutate<RangeData>(
      key,
      (current) => (current ? fn(current, range.from, range.to) : current),
      { revalidate: false },
    );
  }
}

/** Remplace dans le cache les journées renvoyées par le serveur. */
export function applyDays(days: DayData[]) {
  updateRanges((data, from, to) => {
    let next = data;
    for (const day of days) {
      const inRange = day.meta.date >= from && day.meta.date <= to;
      const ids = new Set(day.tasks.map((t) => t.id));
      // Retire les tâches de ce jour (et celles qui en sont parties)
      const tasks = next.tasks.filter((t) => t.date !== day.meta.date && !ids.has(t.id));
      next = {
        days: [
          ...next.days.filter((d) => d.date !== day.meta.date),
          ...(inRange ? [day.meta] : []),
        ],
        tasks: inRange ? [...tasks, ...day.tasks] : tasks,
      };
    }
    return { ...next, tasks: sortTasks(next.tasks) };
  });
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) =>
    a.date === b.date ? a.position - b.position : a.date.localeCompare(b.date),
  );
}

/** Applique une transformation locale + re-planification sur les dates touchées. */
function optimistic(
  settings: UserSettings | undefined,
  dates: string[],
  fn: (tasks: Task[]) => Task[],
) {
  updateRanges((data) => {
    let tasks = fn(data.tasks);
    if (settings) {
      for (const date of new Set(dates)) {
        const dayTasks = tasks.filter((t) => t.date === date);
        const planned = new Map(applyPlan(dayTasks, settings).map((t) => [t.id, t]));
        tasks = tasks.map((t) => planned.get(t.id) ?? t);
      }
    }
    return { ...data, tasks: sortTasks(tasks) };
  });
}

export function revalidateRanges() {
  globalMutate((key) => typeof key === 'string' && key.startsWith('/api/days?'));
}

async function run<T extends { days?: DayData[]; warning?: string }>(
  promise: Promise<T>,
  success?: string,
): Promise<T | null> {
  try {
    const res = await promise;
    if (res.days) applyDays(res.days);
    if (res.warning) toast(res.warning, 'error');
    else if (success) toast(success, 'success');
    return res;
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Erreur inattendue', 'error');
    revalidateRanges();
    return null;
  }
}

// ─── Actions ──────────────────────────────────────────────────

type DaysResponse = { days: DayData[]; warning?: string };

export function createTask(input: TaskInput, settings?: UserSettings) {
  const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  optimistic(settings, [input.date], (tasks) => [
    ...tasks,
    {
      id: tempId,
      userId: '',
      date: input.date,
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? settings?.defaultCategory ?? 'development',
      points: input.points ?? 5,
      status: input.status ?? 'todo',
      position: Number.MAX_SAFE_INTEGER,
      manualDuration: input.manualDuration ?? null,
      durationMinutes: input.manualDuration ?? 60,
      startTime: input.startTime ?? null,
      pinned: input.pinned ?? false,
      actualMinutes: 0,
      jiraKey: input.jiraKey ?? null,
      jiraUrl: null,
      jiraProjectKey: input.createInJiraProject ?? null,
      jiraWorklogId: null,
      jiraSyncedMinutes: null,
      jiraSyncedStart: null,
      jiraSyncedAt: null,
      jiraSyncError: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return run(
    api<DaysResponse & { taskId: string }>('/api/tasks', { method: 'POST', json: input }),
    input.createInJiraProject ? 'Tâche créée et ticket Jira ajouté' : undefined,
  );
}

export function updateTask(task: Task, patch: TaskPatch & Record<string, unknown>, settings?: UserSettings) {
  const dates = [task.date, (patch.date as string | undefined) ?? task.date];
  optimistic(settings, dates, (tasks) =>
    tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
  );
  return run(api<DaysResponse>(`/api/tasks/${task.id}`, { method: 'PATCH', json: patch }));
}

export function deleteTask(task: Task, settings?: UserSettings) {
  optimistic(settings, [task.date], (tasks) => tasks.filter((t) => t.id !== task.id));
  return run(api<DaysResponse>(`/api/tasks/${task.id}`, { method: 'DELETE' }));
}

/** Ajoute le temps mesuré par le minuteur focus (et termine la tâche si demandé). */
export function logFocus(taskId: string, minutes: number, markDone: boolean) {
  const patch: Record<string, unknown> = {};
  if (minutes > 0) patch.addActualMinutes = minutes;
  if (markDone) patch.status = 'done';
  if (Object.keys(patch).length === 0) return Promise.resolve(null);
  return run(
    api<DaysResponse>(`/api/tasks/${taskId}`, { method: 'PATCH', json: patch }),
    minutes > 0 ? `${minutes} min de focus enregistrées` : undefined,
  );
}

export function reorderTasks(date: string, ids: string[], settings?: UserSettings) {
  const order = new Map(ids.map((id, i) => [id, i]));
  optimistic(settings, [date], (tasks) =>
    tasks.map((t) => (order.has(t.id) ? { ...t, position: order.get(t.id)! } : t)),
  );
  return run(api<DaysResponse>('/api/tasks/reorder', { method: 'POST', json: { date, ids } }));
}

export function updateDayMeta(date: string, patch: Partial<DayMeta>) {
  updateRanges((data, from, to) => {
    if (date < from || date > to) return data;
    const current = data.days.find((d) => d.date === date) ?? emptyMeta(date);
    return { ...data, days: [...data.days.filter((d) => d.date !== date), { ...current, ...patch }] };
  });
  return run(
    api<DayData>(`/api/days/${date}`, { method: 'PATCH', json: patch }).then((day) => {
      // Les vues "métadonnées seules" (séries) ne sont pas mises à jour localement
      globalMutate((key) => typeof key === 'string' && key.endsWith('&meta=1'));
      return { days: [day] };
    }),
  );
}

export function carryOver(from: string, to: string) {
  return run(
    api<{ moved: number; from: DayData; to: DayData }>(`/api/days/${from}/carry-over`, {
      method: 'POST',
      json: { to },
    }).then((r) => ({ days: [r.from, r.to], moved: r.moved })),
  );
}

export function syncDay(date: string) {
  return run(
    api<DayData>(`/api/days/${date}/sync`, { method: 'POST' }).then((day) => ({ days: [day] })),
    'Worklogs Jira synchronisés',
  );
}

export function applyTemplates(date: string, ids: string[]) {
  return run(
    api<DaysResponse & { added: number }>('/api/templates/apply', {
      method: 'POST',
      json: { date, ids },
    }),
  );
}

export function importJiraIssues(date: string, issues: { key: string; points: number }[]) {
  return run(
    api<DaysResponse & { added: number }>('/api/jira/import', {
      method: 'POST',
      json: { date, issues },
    }),
  );
}

export async function updateSettings(patch: Partial<UserSettings>) {
  globalMutate<User>(
    '/api/me',
    (u) => (u ? { ...u, settings: { ...u.settings, ...patch } } : u),
    { revalidate: false },
  );
  try {
    const user = await api<User>('/api/me', { method: 'PATCH', json: { settings: patch } });
    globalMutate('/api/me', user, { revalidate: false });
    // Les horaires ont pu changer : les plannings sont recalculés au prochain accès.
    revalidateRanges();
    return user;
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Erreur', 'error');
    globalMutate('/api/me');
    return null;
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  swrCache.clear();
  window.location.href = '/';
}
