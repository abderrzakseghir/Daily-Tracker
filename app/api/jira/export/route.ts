import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import {
  createIssue,
  getJiraConnection,
  jiraErrorMessage,
  pickIssueType,
  transitionToCategory,
  updateIssue,
  type StatusCategory,
} from '@/lib/server/jira';
import { getSettings, replanDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';
import type { Task, TaskStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

const STATUS_CATEGORY: Record<TaskStatus, StatusCategory> = {
  todo: 'new',
  in_progress: 'indeterminate',
  done: 'done',
};

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

/** Titre sans le préfixe « KEY · » ajouté à l'import d'un ticket. */
function summaryOf(t: Task, key: string) {
  const prefix = `${key} · `;
  return t.title.startsWith(prefix) ? t.title.slice(prefix.length) : t.title;
}

/**
 * POST /api/jira/export { date, projectKey, taskIds? }
 *  - crée un ticket pour chaque tâche (choisie) qui n'en a pas, dans son vrai statut ;
 *  - met à jour tous les tickets déjà liés : titre, description, estimation, statut ;
 *  - aligne les worklogs (temps planifié des tâches terminées).
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
  const toUpdate = day.tasks.filter((t) => t.jiraKey);

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

  // Tickets existants : tous les champs ; nouveaux : seulement le statut (le reste vient d'être posé)
  const jobs = [
    ...toUpdate.map((t) => ({ task: t, key: t.jiraKey!, fields: true })),
    ...created.map((t) => ({ task: t, key: t.jiraKey!, fields: false })),
  ];
  const pushed = await mapLimit(jobs, 3, async ({ task, key, fields }) => {
    if (fields) {
      await updateIssue(userId, key, {
        summary: summaryOf(task, key),
        description: task.description,
        estimateMinutes: task.durationMinutes,
      });
    }
    await transitionToCategory(userId, key, STATUS_CATEGORY[task.status]);
  });
  pushed.forEach((r, i) => {
    if (r.status === 'rejected') errors.push(`${jobs[i].key} : ${jiraErrorMessage(r.reason)}`);
  });

  // Worklogs : tâches terminées → temps planifié loggé, les autres → aucun worklog
  const synced = await replanDay(userId, date, { ...settings, autoSyncWorklog: true });

  const syncErrors = synced.tasks.filter((t) => t.jiraKey && t.jiraSyncError).length;
  if (syncErrors > 0) errors.push(`${syncErrors} worklog(s) n'ont pas pu être enregistrés.`);

  return ok({
    days: [synced],
    created: created.length,
    updated: toUpdate.length,
    warning: errors.length ? errors.join('\n') : undefined,
  });
});
