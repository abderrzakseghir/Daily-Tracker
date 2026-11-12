import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { getIssue, jiraErrorMessage } from '@/lib/server/jira';
import { getSettings, nextPosition, replanDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jira/import { date, issues: [{ key, points? }] }
 * Crée une tâche liée pour chaque ticket Jira choisi.
 */
export const POST = withUser(async (req, { userId }) => {
  const { date: rawDate, issues } = await req.json();
  const date = assertDate(rawDate);
  if (!Array.isArray(issues) || issues.length === 0) throw new HttpError(400, 'Aucun ticket choisi');
  if (issues.length > 30) throw new HttpError(400, 'Maximum 30 tickets à la fois');

  const settings = await getSettings(userId);
  const fetched = await Promise.allSettled(
    issues.map((i: { key: string }) => getIssue(userId, String(i.key))),
  );
  const ok_ = fetched.flatMap((r, i) =>
    r.status === 'fulfilled' ? [{ issue: r.value, points: Number(issues[i].points) || 5 }] : [],
  );
  const errors = fetched.flatMap((r, i) =>
    r.status === 'rejected' ? [`${issues[i].key} : ${jiraErrorMessage(r.reason)}`] : [],
  );

  if (ok_.length > 0) {
    const start = await nextPosition(userId, date);
    const { error } = await db()
      .from('tasks')
      .insert(
        ok_.map(({ issue, points }, i) => ({
          user_id: userId,
          date,
          title: `${issue.key} · ${issue.summary}`.slice(0, 300),
          category: settings.defaultCategory,
          points: Math.min(10, Math.max(1, Math.round(points))),
          position: start + i,
          jira_key: issue.key,
          jira_url: issue.url,
          jira_project_key: issue.projectKey,
        })),
      );
    if (error) throw error;
  }

  return ok({
    days: [await replanDay(userId, date, settings)],
    added: ok_.length,
    warning: errors.length ? errors.join('\n') : undefined,
  });
});
