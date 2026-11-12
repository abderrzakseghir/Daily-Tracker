import { HttpError, ok, withUser } from '@/lib/server/http';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** POST /api/push — enregistre l'abonnement push du navigateur. */
export const POST = withUser(async (req, { userId }) => {
  const sub = await req.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw new HttpError(400, 'Abonnement invalide');
  }
  const { error } = await db().from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, user_id: userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
  return ok(true);
});

/** DELETE /api/push — supprime tous les abonnements de l'utilisateur. */
export const DELETE = withUser(async (_req, { userId }) => {
  await db().from('push_subscriptions').delete().eq('user_id', userId);
  return ok(true);
});
