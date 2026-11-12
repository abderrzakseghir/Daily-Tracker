import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { replanDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** POST /api/tasks/reorder { date, ids } — nouvel ordre d'enchaînement de la journée. */
export const POST = withUser(async (req, { userId }) => {
  const { date: rawDate, ids } = await req.json();
  const date = assertDate(rawDate);
  if (!Array.isArray(ids)) throw new HttpError(400, 'ids requis');

  await Promise.all(
    (ids as string[]).map((id, position) =>
      db().from('tasks').update({ position }).eq('id', id).eq('user_id', userId).eq('date', date),
    ),
  );
  return ok({ days: [await replanDay(userId, date)] });
});
