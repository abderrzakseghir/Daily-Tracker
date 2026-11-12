import { NextResponse } from 'next/server';
import { withUser } from '@/lib/server/http';
import { getUser, mapDay, mapTask } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/export — sauvegarde JSON complète des données de l'utilisateur. */
export const GET = withUser(async (_req, { userId }) => {
  const [user, days, tasks, templates] = await Promise.all([
    getUser(userId),
    db().from('days').select('*').eq('user_id', userId).order('date'),
    db().from('tasks').select('*').eq('user_id', userId).order('date').order('position'),
    db().from('task_templates').select('*').eq('user_id', userId),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email, name: user.name, settings: user.settings },
    days: (days.data ?? []).map((r) => mapDay(r, r.date)),
    tasks: (tasks.data ?? []).map(mapTask),
    templates: templates.data ?? [],
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="daily-tracker-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
