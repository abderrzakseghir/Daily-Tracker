import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { normalizeSettings } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/reminder — appelé par Vercel Cron (voir vercel.json).
 * Envoie un rappel aux utilisateurs dont la journée n'est pas encore validée.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ success: false, error: 'VAPID non configuré' }, { status: 500 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', publicKey, privateKey);

  const { data: subs } = await db()
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id, users(settings)');

  let sent = 0;
  for (const sub of subs ?? []) {
    const settings = normalizeSettings((sub as any).users?.settings);
    if (!settings.reminderEnabled) continue;

    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(now);
    const weekday = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (!settings.workdays.includes(weekday)) continue;

    const { data: day } = await db()
      .from('days')
      .select('validated')
      .eq('user_id', sub.user_id)
      .eq('date', today)
      .maybeSingle();
    if (day?.validated) continue;

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: 'Daily Tracker',
          body: "N'oubliez pas de compléter et valider votre journée ✅",
          url: '/dashboard',
        }),
      );
      sent++;
    } catch (err: any) {
      // Abonnement expiré → nettoyage
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
  return NextResponse.json({ success: true, data: { sent } });
}
