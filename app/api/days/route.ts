import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { getRange, mapDay } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD — journées + tâches d'une période. */
export const GET = withUser(async (req, { userId }) => {
  const from = assertDate(req.nextUrl.searchParams.get('from'), 'from');
  const to = assertDate(req.nextUrl.searchParams.get('to'), 'to');
  if (to < from) throw new HttpError(400, 'Période invalide');

  // ?meta=1 : uniquement les métadonnées de journées (séries, humeur…) — plus léger
  if (req.nextUrl.searchParams.get('meta') === '1') {
    const { data, error } = await db()
      .from('days')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);
    if (error) throw error;
    return ok({ days: (data ?? []).map((r) => mapDay(r, r.date)), tasks: [] });
  }
  return ok(await getRange(userId, from, to));
});
