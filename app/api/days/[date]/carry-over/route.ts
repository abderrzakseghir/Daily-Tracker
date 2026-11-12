import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { getDay, nextPosition, replanDay, getSettings } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/days/:date/carry-over { to: YYYY-MM-DD }
 * Reporte les tâches non terminées vers une autre journée.
 */
export const POST = withUser<{ params: { date: string } }>(async (req, { params, userId }) => {
  const from = assertDate(params.date);
  const { to: rawTo } = await req.json();
  const to = assertDate(rawTo, 'to');
  if (to === from) throw new HttpError(400, 'Choisissez une autre journée.');

  const day = await getDay(userId, from);
  const pending = day.tasks.filter((t) => t.status !== 'done');
  if (pending.length === 0) return ok({ moved: 0, from: day, to: await getDay(userId, to) });

  const start = await nextPosition(userId, to);
  await Promise.all(
    pending.map((t, i) =>
      db()
        .from('tasks')
        .update({ date: to, position: start + i, pinned: false, updated_at: new Date().toISOString() })
        .eq('id', t.id).eq('user_id', userId),
    ),
  );

  const settings = await getSettings(userId);
  const [fromDay, toDay] = await Promise.all([
    replanDay(userId, from, settings),
    replanDay(userId, to, settings),
  ]);
  return ok({ moved: pending.length, from: fromDay, to: toDay });
});
