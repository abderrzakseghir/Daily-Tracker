import { HttpError, ok, withUser } from '@/lib/server/http';
import { toTaskColumns } from '@/lib/server/tasks';
import { db } from '@/lib/server/supabase';
import type { TaskTemplate } from '@/types';

export const dynamic = 'force-dynamic';

function mapTemplate(r: any): TaskTemplate {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    points: r.points,
    manualDuration: r.manual_duration,
    startTime: r.start_time,
    weekdays: r.weekdays ?? [],
  };
}

export const GET = withUser(async (_req, { userId }) => {
  const { data, error } = await db()
    .from('task_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return ok((data ?? []).map(mapTemplate));
});

export const POST = withUser(async (req, { userId }) => {
  const body = await req.json();
  const cols = toTaskColumns({
    title: body.title,
    category: body.category ?? 'meeting',
    points: body.points ?? 2,
    manualDuration: body.manualDuration ?? null,
    startTime: body.startTime ?? null,
  });
  const weekdays = Array.isArray(body.weekdays)
    ? [...new Set((body.weekdays as number[]).filter((d) => d >= 1 && d <= 7))]
    : [];
  const { count } = await db()
    .from('task_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) >= 50) throw new HttpError(400, 'Maximum 50 modèles.');

  const { data, error } = await db()
    .from('task_templates')
    .insert({
      user_id: userId,
      title: cols.title,
      category: cols.category,
      points: cols.points,
      manual_duration: cols.manual_duration,
      start_time: cols.start_time,
      weekdays,
    })
    .select('*')
    .single();
  if (error) throw error;
  return ok(mapTemplate(data));
});
