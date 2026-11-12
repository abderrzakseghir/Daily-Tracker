import { ok, withUser } from '@/lib/server/http';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** DELETE /api/jira/connection — déconnecte Jira (les tickets liés restent sur les tâches). */
export const DELETE = withUser(async (_req, { userId }) => {
  const { error } = await db().from('jira_connections').delete().eq('user_id', userId);
  if (error) throw error;
  return ok(true);
});
