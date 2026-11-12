import 'server-only';
import { db } from './supabase';
import { HttpError } from './http';
import {
  deleteWorklog,
  getJiraConnection,
  jiraErrorMessage,
  jiraStarted,
  transitionToDone,
  upsertWorklog,
} from './jira';
import { applyPlan } from '@/lib/planner';
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  type Category,
  type DayData,
  type DayMeta,
  type Task,
  type User,
  type UserSettings,
} from '@/types';

// ─── Mapping lignes SQL ↔ objets ──────────────────────────────

export function mapTask(r: any): Task {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    title: r.title,
    description: r.description ?? '',
    category: (CATEGORIES as readonly string[]).includes(r.category) ? r.category : 'other',
    points: r.points,
    status: r.status,
    position: r.position,
    manualDuration: r.manual_duration,
    durationMinutes: r.duration_minutes,
    startTime: r.start_time,
    pinned: r.pinned,
    actualMinutes: r.actual_minutes ?? 0,
    jiraKey: r.jira_key,
    jiraUrl: r.jira_url,
    jiraProjectKey: r.jira_project_key,
    jiraWorklogId: r.jira_worklog_id,
    jiraSyncedMinutes: r.jira_synced_minutes,
    jiraSyncedStart: r.jira_synced_start ?? null,
    jiraSyncedAt: r.jira_synced_at,
    jiraSyncError: r.jira_sync_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapDay(r: any | null, date: string): DayMeta {
  return {
    date,
    blockers: r?.blockers ?? '',
    notes: r?.notes ?? '',
    mood: r?.mood ?? null,
    energy: r?.energy ?? null,
    validated: r?.validated ?? false,
    validatedAt: r?.validated_at ?? null,
  };
}

export function normalizeSettings(raw: unknown): UserSettings {
  const s = { ...DEFAULT_SETTINGS, ...((raw as Partial<UserSettings>) ?? {}) };
  if (!CATEGORIES.includes(s.defaultCategory as Category)) s.defaultCategory = 'development';
  return s;
}

// ─── Utilisateur ──────────────────────────────────────────────

export async function getUser(userId: string): Promise<User> {
  const [{ data: row, error }, jira] = await Promise.all([
    db().from('users').select('*').eq('id', userId).maybeSingle(),
    getJiraConnection(userId),
  ]);
  if (error) throw error;
  if (!row) throw new HttpError(401, 'Utilisateur introuvable, reconnectez-vous.');
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    settings: normalizeSettings(row.settings),
    createdAt: row.created_at,
    jira: jira
      ? {
          connected: true,
          displayName: jira.display_name,
          email: jira.email,
          avatar: jira.avatar,
          siteName: jira.site_name,
          cloudUrl: jira.cloud_url,
        }
      : { connected: false },
  };
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await db().from('users').select('settings').eq('id', userId).single();
  if (error) throw error;
  return normalizeSettings(data.settings);
}

// ─── Lecture des journées ─────────────────────────────────────

export async function getTask(userId: string, id: string): Promise<Task> {
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Tâche introuvable');
  return mapTask(data);
}

async function getTasksForDate(userId: string, date: string): Promise<Task[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('position')
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function getDay(userId: string, date: string): Promise<DayData> {
  const [{ data: meta, error }, tasks] = await Promise.all([
    db().from('days').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    getTasksForDate(userId, date),
  ]);
  if (error) throw error;
  return { meta: mapDay(meta, date), tasks };
}

export async function getRange(userId: string, from: string, to: string) {
  const [daysRes, tasksRes] = await Promise.all([
    db().from('days').select('*').eq('user_id', userId).gte('date', from).lte('date', to),
    db()
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('position')
      .order('created_at'),
  ]);
  if (daysRes.error) throw daysRes.error;
  if (tasksRes.error) throw tasksRes.error;
  return {
    days: (daysRes.data ?? []).map((r) => mapDay(r, r.date)),
    tasks: (tasksRes.data ?? []).map(mapTask),
  };
}

export async function upsertDayMeta(userId: string, date: string, patch: Record<string, unknown>) {
  const { error } = await db()
    .from('days')
    .upsert(
      { user_id: userId, date, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    );
  if (error) throw error;
}

// ─── Re-planification + synchronisation Jira ──────────────────

/**
 * Recalcule durées et horaires de la journée, persiste les changements,
 * puis (si activé) met à jour les worklogs Jira des tâches terminées.
 */
export async function replanDay(userId: string, date: string, settings?: UserSettings): Promise<DayData> {
  const s = settings ?? (await getSettings(userId));
  const tasks = await getTasksForDate(userId, date);
  const planned = applyPlan(tasks, s);

  const changed = planned.filter((t, i) =>
    t.startTime !== tasks[i].startTime || t.durationMinutes !== tasks[i].durationMinutes,
  );
  await Promise.all(
    changed.map((t) =>
      db()
        .from('tasks')
        .update({ start_time: t.startTime, duration_minutes: t.durationMinutes })
        .eq('id', t.id),
    ),
  );

  if (s.autoSyncWorklog) {
    const toSync = planned.filter((t) => t.jiraKey && worklogOutOfDate(t));
    if (toSync.length > 0 && (await getJiraConnection(userId))) {
      await Promise.allSettled(toSync.map((t) => syncWorklog(userId, t, s)));
    }
  }

  return getDay(userId, date);
}

function syncedStamp(t: Task) {
  return `${t.date} ${t.startTime ?? ''}`;
}

/** true si le worklog Jira ne reflète plus l'état de la tâche. */
export function worklogOutOfDate(t: Task): boolean {
  if (!t.jiraKey) return false;
  if (t.status !== 'done') return Boolean(t.jiraWorklogId);
  return (
    !t.jiraWorklogId ||
    t.jiraSyncedMinutes !== t.durationMinutes ||
    t.jiraSyncedStart !== syncedStamp(t) ||
    t.jiraSyncError != null
  );
}

/**
 * Aligne le worklog Jira sur la tâche :
 *  - tâche terminée → worklog créé/mis à jour (durée + horaire planifiés)
 *  - tâche rouverte → worklog supprimé
 */
export async function syncWorklog(userId: string, t: Task, s: UserSettings): Promise<void> {
  if (!t.jiraKey) return;
  const now = new Date().toISOString();
  try {
    if (t.status !== 'done') {
      if (t.jiraWorklogId) await deleteWorklog(userId, t.jiraKey, t.jiraWorklogId);
      await db()
        .from('tasks')
        .update({
          jira_worklog_id: null,
          jira_synced_minutes: null,
          jira_synced_start: null,
          jira_synced_at: now,
          jira_sync_error: null,
        })
        .eq('id', t.id);
      return;
    }
    const time = t.startTime ?? s.workdayStart;
    const worklogId = await upsertWorklog(userId, {
      key: t.jiraKey,
      worklogId: t.jiraWorklogId,
      minutes: t.durationMinutes,
      started: jiraStarted(t.date, time, s.timezone),
      comment: `Daily Tracker — ${t.title}`,
    });
    await db()
      .from('tasks')
      .update({
        jira_worklog_id: worklogId,
        jira_synced_minutes: t.durationMinutes,
        jira_synced_start: syncedStamp(t),
        jira_synced_at: now,
        jira_sync_error: null,
      })
      .eq('id', t.id);
  } catch (err) {
    const message = jiraErrorMessage(err);
    console.error('[Jira sync]', t.jiraKey, message);
    await db().from('tasks').update({ jira_sync_error: message }).eq('id', t.id);
  }
}

/** Passe le ticket Jira à "Terminé" (best effort). */
export async function maybeTransitionDone(userId: string, t: Task, s: UserSettings) {
  if (!t.jiraKey || !s.autoTransitionDone) return;
  try {
    await transitionToDone(userId, t.jiraKey);
  } catch (err) {
    console.warn('[Jira transition]', t.jiraKey, jiraErrorMessage(err));
  }
}

export async function nextPosition(userId: string, date: string): Promise<number> {
  const { data } = await db()
    .from('tasks')
    .select('position')
    .eq('user_id', userId)
    .eq('date', date)
    .order('position', { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}
