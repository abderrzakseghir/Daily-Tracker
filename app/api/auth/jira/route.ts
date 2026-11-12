import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl, isNonCanonicalHost, isProd, jiraRedirectUri } from '@/lib/server/env';
import { JIRA_SCOPES } from '@/lib/server/jira';
import { SESSION_COOKIE, verifySession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const clientId = process.env.JIRA_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=not_configured`);

  if (isNonCanonicalHost(req)) {
    return NextResponse.redirect(`${appUrl}/api/auth/jira`);
  }
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.redirect(`${appUrl}/?error=session`);
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: JIRA_SCOPES,
    redirect_uri: jiraRedirectUri(req),
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  const response = NextResponse.redirect(`https://auth.atlassian.com/authorize?${params}`);
  response.cookies.set('jira_oauth_state', state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
