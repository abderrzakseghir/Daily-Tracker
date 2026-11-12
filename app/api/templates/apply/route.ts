import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { getDay, nextPosition, replanDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/apply { date, ids }
 * Ajoute les modèles choisis à la journée (ignore ceux déjà présents, même titre).
 */
export const POST = withUser(async (req, { userId }) => {
  const { date: rawDate, ids } = await req.json();
  const date = assertDate(rawDate);
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpError(400, 'Aucun modèle choisi');

  const [{ data: templates, error }, day] = await Promise.all([
    db().from('task_templates').select('*').eq('user_id', userId).in('id', ids),
    getDay(userId, date),
  ]);
  if (error) throw error;

  const existing = new Set(day.tasks.map((t) => t.title.toLowerCase()));
  const toAdd = (templates ?? []).filter((t) => !existing.has(t.title.toLowerCase()));
  if (toAdd.length > 0) {
    const start = await nextPosition(userId, date);
    const { error: insertError } = await db()
      .from('tasks')
      .insert(
        toAdd.map((t, i) => ({
          user_id: userId,
          date,
          title: t.title,
          category: t.category,
          points: t.points,
          manual_duration: t.manual_duration,
          start_time: t.start_time,
          pinned: Boolean(t.start_time),
          position: start + i,
        })),
      );
    if (insertError) throw insertError;
  }
  return ok({ days: [await replanDay(userId, date)], added: toAdd.length });
});
