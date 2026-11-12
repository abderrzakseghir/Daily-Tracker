import { ok, withUser } from '@/lib/server/http';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export const DELETE = withUser<{ params: { id: string } }>(async (_req, { params, userId }) => {
  const { error } = await db()
    .from('task_templates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);
  if (error) throw error;
  return ok(true);
});
