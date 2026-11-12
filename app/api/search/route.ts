import { ok, withUser } from '@/lib/server/http';
import { mapTask } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/search?q=texte — recherche dans les titres, descriptions et clés Jira. */
export const GET = withUser(async (req, { userId }) => {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return ok([]);
  // Caractères spéciaux du filtre PostgREST (.or) et de ILIKE neutralisés
  const pattern = `%${q.replace(/[%_,().\\*]/g, ' ')}%`;
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .or(`title.ilike.${pattern},description.ilike.${pattern},jira_key.ilike.${pattern}`)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ok((data ?? []).map(mapTask));
});
