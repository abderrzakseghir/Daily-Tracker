import { ok, withUser } from '@/lib/server/http';
import { deleteWorklog, jiraErrorMessage } from '@/lib/server/jira';
import {
  getSettings,
  getTask,
  maybeTransitionDone,
  nextPosition,
  replanDay,
} from '@/lib/server/repo';
import { attachJira, toTaskColumns } from '@/lib/server/tasks';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * PATCH /api/tasks/:id
 * Champs de tâche + options Jira :
 *   createInJiraProject: "PROJ"  → crée le ticket
 *   jiraKey: "PROJ-12" | null    → lie / délie un ticket existant
 */
export const PATCH = withUser<Ctx>(async (req, { params, userId }) => {
  const body = await req.json();
  const before = await getTask(userId, params.id);
  const settings = await getSettings(userId);
  const cols = toTaskColumns(body);
  // Minuteur focus : incrément du temps mesuré
  if (Number(body.addActualMinutes) > 0) {
    cols.actual_minutes = before.actualMinutes + Math.round(Number(body.addActualMinutes));
  }

  // Changement de jour : la tâche passe en fin de file, sauf horaire fixé.
  if (cols.date && cols.date !== before.date && cols.position === undefined) {
    cols.position = await nextPosition(userId, cols.date as string);
  }

  let warning: string | undefined;

  // Délier le ticket Jira (le worklog éventuel est retiré)
  if (body.jiraKey === null && before.jiraKey) {
    if (before.jiraWorklogId) {
      await deleteWorklog(userId, before.jiraKey, before.jiraWorklogId).catch((e) => {
        warning = jiraErrorMessage(e);
      });
    }
    Object.assign(cols, {
      jira_key: null,
      jira_url: null,
      jira_project_key: null,
      jira_worklog_id: null,
      jira_synced_minutes: null,
      jira_synced_start: null,
      jira_sync_error: null,
    });
  }

  if (Object.keys(cols).length > 0) {
    const { error } = await db()
      .from('tasks')
      .update({ ...cols, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', userId);
    if (error) throw error;
  }

  if (body.createInJiraProject || (typeof body.jiraKey === 'string' && body.jiraKey)) {
    warning =
      (await attachJira(
        userId,
        params.id,
        { createInProject: body.createInJiraProject, linkKey: body.jiraKey },
        settings,
      )) ?? warning;
  }

  const dates = new Set([before.date, (cols.date as string | undefined) ?? before.date]);
  const days = await Promise.all([...dates].map((d) => replanDay(userId, d, settings)));

  if (cols.status === 'done' && before.status !== 'done') {
    const after = days.flatMap((d) => d.tasks).find((t) => t.id === params.id);
    if (after) await maybeTransitionDone(userId, after, settings);
  }

  return ok({ days, warning });
});

/** DELETE /api/tasks/:id — supprime la tâche et son worklog Jira éventuel. */
export const DELETE = withUser<Ctx>(async (_req, { params, userId }) => {
  const task = await getTask(userId, params.id);
  let warning: string | undefined;
  if (task.jiraKey && task.jiraWorklogId) {
    await deleteWorklog(userId, task.jiraKey, task.jiraWorklogId).catch((e) => {
      warning = jiraErrorMessage(e);
    });
  }
  const { error } = await db().from('tasks').delete().eq('id', params.id).eq('user_id', userId);
  if (error) throw error;
  return ok({ days: [await replanDay(userId, task.date)], warning });
});
