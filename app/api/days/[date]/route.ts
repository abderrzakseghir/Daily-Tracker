import { assertDate, HttpError, ok, withUser } from '@/lib/server/http';
import { getDay, getSettings, replanDay, upsertDayMeta } from '@/lib/server/repo';
import type { DayMeta } from '@/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { date: string } };

export const GET = withUser<Ctx>(async (_req, { params, userId }) => {
  return ok(await getDay(userId, assertDate(params.date)));
});

/** PATCH /api/days/:date — bloquants, notes, humeur, énergie, validation. */
export const PATCH = withUser<Ctx>(async (req, { params, userId }) => {
  const date = assertDate(params.date);
  const body = (await req.json()) as Partial<DayMeta>;
  const patch: Record<string, unknown> = {};

  if (typeof body.blockers === 'string') patch.blockers = body.blockers.slice(0, 5000);
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 10000);
  for (const key of ['mood', 'energy'] as const) {
    if (body[key] === null) patch[key] = null;
    else if (body[key] !== undefined) {
      const v = Number(body[key]);
      if (!(v >= 1 && v <= 5)) throw new HttpError(400, `${key} doit être entre 1 et 5`);
      patch[key] = v;
    }
  }
  if (typeof body.validated === 'boolean') {
    patch.validated = body.validated;
    patch.validated_at = body.validated ? new Date().toISOString() : null;
  }

  await upsertDayMeta(userId, date, patch);

  // Valider la journée = s'assurer que tous les worklogs sont à jour.
  if (body.validated === true) {
    const settings = await getSettings(userId);
    return ok(await replanDay(userId, date, { ...settings, autoSyncWorklog: true }));
  }
  return ok(await getDay(userId, date));
});
