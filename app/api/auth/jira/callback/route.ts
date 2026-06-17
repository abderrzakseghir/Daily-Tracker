import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = req.nextUrl.origin;

  console.log('[Jira OAuth] ① Callback received — code:', code ? '✓ present' : '✗ missing', '| state:', state ? '✓ present' : '✗ missing');

  // Validate state to prevent CSRF
  const storedState = req.cookies.get('jira_oauth_state')?.value;
  if (!code || !state || state !== storedState) {
    console.error('[Jira OAuth] ① CSRF check failed — storedState:', storedState, '| receivedState:', state);
    return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=invalid_state`);
  }
  console.log('[Jira OAuth] ① CSRF state OK');

  try {
    // ── Step 2: Exchange authorization code for tokens ──────────────────────
    console.log('[Jira OAuth] ② Exchanging code for tokens…');
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
      const errBody = await tokenRes.text();
      console.error('[Jira OAuth] ② Token exchange FAILED — status:', tokenRes.status, '| body:', errBody);
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json();
    console.log('[Jira OAuth] ② Tokens received — access_token:', tokens.access_token ? '✓' : '✗', '| refresh_token:', tokens.refresh_token ? '✓' : '✗', '| expires_in:', tokens.expires_in);

    // ── Step 3: Get Cloud ID via accessible-resources ────────────────────────
    console.log('[Jira OAuth] ③ Fetching accessible-resources for Cloud ID…');
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!resourcesRes.ok) {
      console.error('[Jira OAuth] ③ accessible-resources FAILED — status:', resourcesRes.status);
      throw new Error(`accessible-resources fetch failed: ${resourcesRes.status}`);
    }
    const resources = await resourcesRes.json();
    // Log the full array so we can verify which cloudId is extracted
    console.log('[Jira OAuth] ③ accessible-resources — full list:', JSON.stringify(resources, null, 2));

    // Filter for a Jira resource: must have read:jira-work or read:jira-user in its scopes.
    // Using resources[0] without filtering may pick a Confluence site, which causes 410
    // when used against the Jira REST API.
    const jiraResource = resources.find(
      (r: { id: string; name: string; url: string; scopes: string[] }) =>
        Array.isArray(r.scopes) &&
        (r.scopes.includes('read:jira-work') || r.scopes.includes('read:jira-user'))
    );
    const resource = jiraResource ?? resources[0];

    console.log(
      '[Jira OAuth] ③ Selected resource —',
      resource ? `name="${resource.name}" id="${resource.id}" scopes=${JSON.stringify(resource.scopes)}` : 'NONE'
    );

    if (!resource) {
      throw new Error('No accessible Jira site found — check the app scopes on developer.atlassian.com');
    }

    // ── Step 4: Get user info via Jira API (requires read:jira-user) ─────────
    // Using /myself instead of api.atlassian.com/me to avoid needing read:me scope
    console.log('[Jira OAuth] ④ Fetching user info from Jira API /myself…');
    const userRes = await fetch(
      `https://api.atlassian.com/ex/jira/${resource.id}/rest/api/3/myself`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!userRes.ok) {
      console.error('[Jira OAuth] ④ User info FAILED — status:', userRes.status);
      throw new Error(`User info fetch failed: ${userRes.status}`);
    }
    const jiraUser = await userRes.json();
    console.log('[Jira OAuth] ④ User info OK — accountId:', jiraUser.accountId, '| email:', jiraUser.emailAddress);

    // ── Step 5: Build connection object ──────────────────────────────────────
    const connection = {
      accountId: jiraUser.accountId,
      displayName: jiraUser.displayName,
      email: jiraUser.emailAddress,
      cloudId: resource.id,
      cloudUrl: resource.url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    console.log('[Jira OAuth] ⑤ Connection object built — cloudId:', connection.cloudId, '| cloudUrl:', connection.cloudUrl, '| expiresAt:', new Date(connection.expiresAt).toISOString());

    // ── Return HTML bridge page that writes to Zustand localStorage ───────────
    // This avoids race conditions and fragment-stripping with server redirects.
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
        if (!store.state.user) {
          console.error('[jira-callback] No user in localStorage — user must be logged in before connecting Jira');
          window.location.replace('/settings?jira=error&reason=no_local_user');
          return;
        }
        store.state.user.jira = connection;
        // Reset cached tickets so they are re-fetched
        store.state.jiraTickets = [];
        localStorage.setItem('${storageKey}', JSON.stringify(store));
        console.log('[jira-callback] localStorage updated with Jira connection for', connection.email);
        window.location.replace('/settings?jira=connected');
      } catch(e) {
        console.error('[jira-callback]', e);
        window.location.replace('/settings?jira=error&reason=localstorage_error');
      }
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': 'jira_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      },
    });
  } catch (err) {
    console.error('[Jira OAuth] ✗ Unhandled error in callback:', err);
    return NextResponse.redirect(`${appUrl}/settings?jira=error&reason=server_error`);
  }
}
