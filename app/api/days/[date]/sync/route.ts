import { assertDate, ok, withUser } from '@/lib/server/http';
import { getSettings, replanDay } from '@/lib/server/repo';

export const dynamic = 'force-dynamic';

/** POST /api/days/:date/sync — force la synchronisation des worklogs Jira de la journée. */
export const POST = withUser<{ params: { date: string } }>(async (_req, { params, userId }) => {
  const date = assertDate(params.date);
  const settings = await getSettings(userId);
  return ok(await replanDay(userId, date, { ...settings, autoSyncWorklog: true }));
});
