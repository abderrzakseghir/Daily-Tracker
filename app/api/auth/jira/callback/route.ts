import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = req.nextUrl.origin; // always correct, no env var needed

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

    // Return an HTML page that writes directly to Zustand localStorage and redirects.
    // This avoids all race conditions and fragment-stripping issues with server redirects.
    const connectionJson = JSON.stringify(connection);
    const storageKey = 'daily-tracker-storage';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Connexion Jira…</title>
  <style>
    body { margin: 0; background: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; }
    .wrap { text-align: center; color: #888; font-size: 14px; }
    .spinner { width: 32px; height: 32px; border: 2px solid #333; border-top-color: #3b82f6; border-radius: 50%; animation: spin .7s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spinner"></div>
    <p>Connexion Jira en cours…</p>
  </div>
  <script>
    (function() {
      try {
        var connection = ${connectionJson};
        var raw = localStorage.getItem('${storageKey}');
        var store = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        if (!store.state) store.state = {};
        if (store.state.user) {
          store.state.user.jira = connection;
        }
        // Also persist jiraTickets reset
        store.state.jiraTickets = store.state.jiraTickets || [];
        localStorage.setItem('${storageKey}', JSON.stringify(store));
        window.location.replace('/settings');
      } catch(e) {
        console.error('[jira-callback]', e);
        window.location.replace('/settings?jira=error');
      }
    })();
  </script>
</body>
</html>`;

    const response = new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    // Clear the state cookie
    const res = NextResponse.next();
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': 'jira_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      },
    });
  } catch (err) {
    console.error('[Jira OAuth callback]', err);
    return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=server_error`);
  }
}
