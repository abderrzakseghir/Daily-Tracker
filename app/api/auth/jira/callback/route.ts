import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl, jiraRedirectUri } from '@/lib/server/env';
import { SESSION_COOKIE, verifySession } from '@/lib/server/session';
import { db } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('jira_oauth_state')?.value;

  const done = (query: string) => {
    const res = NextResponse.redirect(`${appUrl}/settings?${query}`);
    res.cookies.delete('jira_oauth_state');
    return res;
  };

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.redirect(`${appUrl}/?error=session`);
  if (searchParams.get('error')) return done('jira=error&reason=denied');
  if (!code || !state || state !== storedState) return done('jira=error&reason=invalid_state');

  try {
    // ① Jetons
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: jiraRedirectUri(req),
      }),
    });
    if (!tokenRes.ok) {
      console.error('[Jira OAuth] token', tokenRes.status, await tokenRes.text());
      return done('jira=error&reason=token_exchange');
    }
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      console.warn('[Jira OAuth] pas de refresh_token — vérifiez le scope offline_access');
    }

    // ② Site Jira (pas Confluence)
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!resourcesRes.ok) return done('jira=error&reason=resources');
    const resources: { id: string; name: string; url: string; scopes: string[] }[] =
      await resourcesRes.json();
    const site =
      resources.find((r) => r.scopes?.some((s) => s.includes('jira-work'))) ?? resources[0];
    if (!site) return done('jira=error&reason=no_site');

    // ③ Profil Jira
    const meRes = await fetch(`https://api.atlassian.com/ex/jira/${site.id}/rest/api/3/myself`, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    });
    if (!meRes.ok) return done('jira=error&reason=profile');
    const me = await meRes.json();

    // ④ Stockage côté serveur
    const now = new Date().toISOString();
    const { error } = await db()
      .from('jira_connections')
      .upsert(
        {
          user_id: userId,
          account_id: me.accountId,
          display_name: me.displayName,
          email: me.emailAddress ?? null,
          avatar: me.avatarUrls?.['48x48'] ?? null,
          cloud_id: site.id,
          cloud_url: site.url,
          site_name: site.name,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? '',
          expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );
    if (error) throw error;

    return done('jira=connected');
  } catch (err) {
    console.error('[Jira OAuth] callback', err);
    return done('jira=error&reason=server');
  }
}
