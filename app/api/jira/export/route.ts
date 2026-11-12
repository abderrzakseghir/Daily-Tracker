import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { createIssue, getJiraConnection, jiraErrorMessage, pickIssueType } from '@/lib/server/jira';
import { getSettings, maybeTransitionDone, replanDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';
import type { Task } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

/** Exécute `fn` sur chaque élément avec au plus `limit` appels Jira simultanés. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * POST /api/jira/export { date, projectKey, taskIds? }
 * Crée un ticket Jira pour chaque tâche de la journée qui n'en a pas encore
 * (estimation = durée planifiée), puis aligne les worklogs de toutes les tâches liées.
 * Ré-exécutable : seules les tâches sans ticket sont créées.
 */
export const POST = withUser(async (req, { userId }) => {
  const body = await req.json();
  const date = assertDate(body.date);
  const taskIds: string[] | null = Array.isArray(body.taskIds) ? body.taskIds.map(String) : null;

  if (!(await getJiraConnection(userId))) throw new HttpError(400, "Jira n'est pas connecté.");
  const settings = await getSettings(userId);

  // Durées et horaires à jour avant de les envoyer
  const day = await replanDay(userId, date, settings);
  const toCreate = day.tasks.filter((t) => !t.jiraKey && (!taskIds || taskIds.includes(t.id)));

  const errors: string[] = [];
  const created: Task[] = [];

  if (toCreate.length > 0) {
    const projectKey = String(body.projectKey ?? '').trim().toUpperCase();
    if (!PROJECT_KEY.test(projectKey)) throw new HttpError(400, 'Choisissez un projet Jira.');

    let issueTypeId: string;
    try {
      issueTypeId = await pickIssueType(userId, projectKey);
    } catch (err) {
      throw new HttpError(400, jiraErrorMessage(err));
    }

    const results = await mapLimit(toCreate, 3, async (t) => {
      const issue = await createIssue(userId, {
        projectKey,
        issueTypeId,
        summary: t.title,
        description: t.description,
        estimateMinutes: t.durationMinutes,
      });
      const { error } = await db()
        .from('tasks')
        .update({
          jira_key: issue.key,
          jira_url: issue.url,
          jira_project_key: projectKey,
          jira_sync_error: null,
        })
        .eq('id', t.id)
        .eq('user_id', userId);
      if (error) throw error;
      return { ...t, jiraKey: issue.key };
    });

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') created.push(r.value);
      else errors.push(`« ${toCreate[i].title} » : ${jiraErrorMessage(r.reason)}`);
    });
  }

  // Worklogs : tâches terminées → temps planifié loggé, les autres → aucun worklog
  const synced = await replanDay(userId, date, { ...settings, autoSyncWorklog: true });

  await Promise.all(
    created.filter((t) => t.status === 'done').map((t) => maybeTransitionDone(userId, t, settings)),
  );

  const syncErrors = synced.tasks.filter((t) => t.jiraKey && t.jiraSyncError).length;
  if (syncErrors > 0) errors.push(`${syncErrors} worklog(s) n'ont pas pu être enregistrés.`);

  return ok({
    days: [synced],
    created: created.length,
    linked: synced.tasks.filter((t) => t.jiraKey).length,
    warning: errors.length ? errors.join('\n') : undefined,
  });
});
