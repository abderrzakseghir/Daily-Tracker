import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl, googleRedirectUri, jiraRedirectUri } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — diagnostic de configuration (aucun secret exposé).
 * Indique notamment les redirect_uri EXACTES à déclarer chez Google et Atlassian.
 */
export async function GET(req: NextRequest) {
  const has = (k: string) => Boolean(process.env[k]);
  let database: 'ok' | 'error' | 'not_configured' = 'not_configured';
  let databaseError: string | undefined;

  if ((has('SUPABASE_URL') || has('NEXT_PUBLIC_SUPABASE_URL')) && has('SUPABASE_SERVICE_ROLE_KEY')) {
    try {
      const { db } = await import('@/lib/server/supabase');
      const { error } = await db().from('users').select('id', { head: true, count: 'exact' });
      database = error ? 'error' : 'ok';
      databaseError = error?.message;
    } catch (e) {
      database = 'error';
      databaseError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      appUrl: getAppUrl(req),
      googleRedirectUri: googleRedirectUri(req),
      jiraRedirectUri: jiraRedirectUri(req),
      google: has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET'),
      jira: has('JIRA_CLIENT_ID') && has('JIRA_CLIENT_SECRET'),
      session: (process.env.SESSION_SECRET ?? '').length >= 32,
      database,
      databaseError,
      push: has('NEXT_PUBLIC_VAPID_PUBLIC_KEY') && has('VAPID_PRIVATE_KEY'),
    },
  });
}
