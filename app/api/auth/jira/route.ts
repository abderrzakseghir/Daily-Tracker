import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.JIRA_CLIENT_ID;
  const appUrl = req.nextUrl.origin; // always correct, no env var needed

  if (!clientId) {
    return NextResponse.json(
      { error: 'JIRA_CLIENT_ID not configured' },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'read:jira-user read:jira-work write:jira-work offline_access read:account',
    redirect_uri: `${appUrl}/api/auth/jira/callback`,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  const response = NextResponse.redirect(
    `https://auth.atlassian.com/authorize?${params}`
  );

  // Short-lived state cookie to prevent CSRF
  response.cookies.set('jira_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return response;
}
