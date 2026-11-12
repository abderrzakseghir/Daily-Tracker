import 'server-only';
import { HHMM, HttpError } from './http';
import { createIssue, getIssue, getJiraConnection, jiraErrorMessage } from './jira';
import { getTask } from './repo';
import { db } from './supabase';
import { CATEGORIES, TASK_STATUSES, type Task, type UserSettings } from '@/types';

/** Valide et convertit un patch client en colonnes SQL. */
export function toTaskColumns(body: Record<string, unknown>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new HttpError(400, 'Le titre est obligatoire.');
    cols.title = title.slice(0, 300);
  }
  if (body.description !== undefined) cols.description = String(body.description).slice(0, 5000);
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category as never)) throw new HttpError(400, 'Catégorie inconnue');
    cols.category = body.category;
  }
  if (body.points !== undefined) {
    const p = Math.round(Number(body.points));
    if (!(p >= 1 && p <= 10)) throw new HttpError(400, 'Les points vont de 1 à 10.');
    cols.points = p;
  }
  if (body.status !== undefined) {
    if (!TASK_STATUSES.includes(body.status as never)) throw new HttpError(400, 'Statut inconnu');
    cols.status = body.status;
  }
  if (body.position !== undefined) cols.position = Math.max(0, Math.round(Number(body.position)));
  if (body.manualDuration !== undefined) {
    if (body.manualDuration === null) cols.manual_duration = null;
    else {
      const d = Math.round(Number(body.manualDuration));
      if (!(d >= 5 && d <= 16 * 60)) throw new HttpError(400, 'Durée entre 5 min et 16 h.');
      cols.manual_duration = d;
    }
  }
  if (body.startTime !== undefined) {
    if (body.startTime !== null && !HHMM.test(String(body.startTime))) {
      throw new HttpError(400, 'Horaire invalide (HH:MM).');
    }
    cols.start_time = body.startTime;
  }
  if (body.pinned !== undefined) cols.pinned = Boolean(body.pinned);
  if (body.actualMinutes !== undefined) {
    cols.actual_minutes = Math.max(0, Math.round(Number(body.actualMinutes)));
  }
  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) throw new HttpError(400, 'Date invalide');
    cols.date = body.date;
  }
  return cols;
}

/**
 * Crée un ticket Jira pour la tâche ou la lie à un ticket existant.
 * Ne lève jamais : retourne un message d'avertissement en cas d'échec.
 */
export async function attachJira(
  userId: string,
  taskId: string,
  opts: { createInProject?: string | null; linkKey?: string | null },
  settings: UserSettings,
): Promise<string | undefined> {
  if (!opts.createInProject && !opts.linkKey) return;
  if (!(await getJiraConnection(userId))) return "Jira n'est pas connecté.";

  try {
    const task: Task = await getTask(userId, taskId);
    let key: string;
    let url: string;
    let projectKey: string;

    if (opts.linkKey) {
      const issue = await getIssue(userId, opts.linkKey.trim().toUpperCase());
      ({ key, url, projectKey } = issue);
    } else {
      const created = await createIssue(userId, {
        projectKey: opts.createInProject!,
        summary: task.title,
        description: task.description,
        estimateMinutes:
          settings.durationMode === 'perPoint' || task.manualDuration
            ? task.durationMinutes
            : undefined,
      });
      ({ key, url } = created);
      projectKey = opts.createInProject!;
    }

    await db()
      .from('tasks')
      .update({ jira_key: key, jira_url: url, jira_project_key: projectKey, jira_sync_error: null })
      .eq('id', taskId).eq('user_id', userId);
  } catch (err) {
    const msg = jiraErrorMessage(err);
    await db().from('tasks').update({ jira_sync_error: msg }).eq('id', taskId).eq('user_id', userId);
    return msg;
  }
}
