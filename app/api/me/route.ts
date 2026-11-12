import { NextResponse } from 'next/server';
import { HHMM, HttpError, ok, withUser } from '@/lib/server/http';
import { getUser, getSettings } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';
import { SESSION_COOKIE } from '@/lib/server/session';
import { CATEGORIES, type UserSettings } from '@/types';

export const dynamic = 'force-dynamic';

export const GET = withUser(async (_req, { userId }) => ok(await getUser(userId)));

/** PATCH /api/me — met à jour les paramètres (fusion partielle). */
export const PATCH = withUser(async (req, { userId }) => {
  const body = (await req.json()) as { settings?: Partial<UserSettings> };
  const patch = body.settings ?? {};

  for (const key of ['workdayStart', 'workdayEnd', 'lunchStart', 'lunchEnd'] as const) {
    if (patch[key] !== undefined && !HHMM.test(String(patch[key]))) {
      throw new HttpError(400, `Horaire invalide : ${key}`);
    }
  }
  if (patch.minutesPerPoint !== undefined && !(patch.minutesPerPoint >= 5 && patch.minutesPerPoint <= 240)) {
    throw new HttpError(400, 'Minutes par point : entre 5 et 240');
  }
  if (patch.defaultCategory && !CATEGORIES.includes(patch.defaultCategory)) {
    throw new HttpError(400, 'Catégorie inconnue');
  }

  const current = await getSettings(userId);
  const settings = { ...current, ...patch };
  if (settings.workdayEnd <= settings.workdayStart) {
    throw new HttpError(400, 'La fin de journée doit être après le début.');
  }

  const { error } = await db()
    .from('users')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
  return ok(await getUser(userId));
});

/** DELETE /api/me — supprime le compte et toutes les données (cascade). */
export const DELETE = withUser(async (_req, { userId }) => {
  const { error } = await db().from('users').delete().eq('id', userId);
  if (error) throw error;
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
