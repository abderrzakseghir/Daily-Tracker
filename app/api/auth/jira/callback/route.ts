import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Validate state to prevent CSRF
  const storedState = req.cookies.get('jira_oauth_state')?.value;
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=invalid_state`);
  }

  try {
    // Exchange code for tokens (server-side only — secret never exposed)
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/auth/jira/callback`,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json();

    // Get Atlassian user info
    const userRes = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const jiraUser = await userRes.json();

    // Get cloud ID + URL (the Jira instance URL)
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const resources = await resourcesRes.json();
    const resource = resources[0]; // first accessible Jira site

    if (!resource) {
      throw new Error('No accessible Jira site found');
    }

    const connection = {
      accountId: jiraUser.accountId,
      displayName: jiraUser.displayName,
      email: jiraUser.email,
      cloudId: resource.id,
      cloudUrl: resource.url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };

    // Store connection data in a short-lived httpOnly cookie
    // Client claims it once via /api/auth/jira/session, then it's deleted
    const response = NextResponse.redirect(`${appUrl}/settings?jira=connected`);

    response.cookies.set('jira_connection', JSON.stringify(connection), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60, // 60 seconds to claim
      path: '/',
    });

    response.cookies.delete('jira_oauth_state');
    return response;
  } catch (err) {
    console.error('[Jira OAuth callback]', err);
    return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=server_error`);
  }
}
