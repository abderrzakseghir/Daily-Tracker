import { assertDate, ok, withUser } from '@/lib/server/http';
import { getSettings, nextPosition, replanDay } from '@/lib/server/repo';
import { attachJira, toTaskColumns } from '@/lib/server/tasks';
import { db } from '@/lib/server/supabase';
import type { TaskInput } from '@/types';

export const dynamic = 'force-dynamic';

/** POST /api/tasks — crée une tâche (et éventuellement son ticket Jira). */
export const POST = withUser(async (req, { userId }) => {
  const body = (await req.json()) as TaskInput;
  const date = assertDate(body.date);
  const settings = await getSettings(userId);

  const cols = toTaskColumns({
    category: settings.defaultCategory,
    points: 5,
    ...body,
  });
  if (!cols.title) cols.title = 'Nouvelle tâche';

  const { data, error } = await db()
    .from('tasks')
    .insert({
      ...cols,
      user_id: userId,
      date,
      position: await nextPosition(userId, date),
    })
    .select('id')
    .single();
  if (error) throw error;

  // Planification d'abord : l'estimation Jira utilise la durée calculée.
  const planned = await replanDay(userId, date, settings);

  const projectKey =
    body.createInJiraProject !== undefined
      ? body.createInJiraProject
      : settings.autoCreateJiraIssue && !body.jiraKey
        ? settings.defaultJiraProject
        : null;
  if (!projectKey && !body.jiraKey) return ok({ days: [planned], taskId: data.id });

  const warning = await attachJira(
    userId,
    data.id,
    { createInProject: projectKey, linkKey: body.jiraKey },
    settings,
  );
  const day = await replanDay(userId, date, settings);
  return ok({ days: [day], taskId: data.id, warning });
});
