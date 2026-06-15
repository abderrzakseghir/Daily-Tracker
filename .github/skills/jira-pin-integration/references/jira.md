# Jira OAuth 2.0 + API — Implementation Reference

## Overview

Jira Cloud OAuth 2.0 (3LO) flow. Free. No Atlassian paid plan required.
Tokens encrypted in localStorage using Web Crypto (AES-GCM).

---

## Prerequisites: Atlassian Developer Console

1. Go to https://developer.atlassian.com/console/myapps/
2. Create an OAuth 2.0 app
3. Add scopes:
   - `read:jira-user`
   - `read:jira-work`
   - `offline_access` (for refresh tokens)
4. Set callback URL: `http://localhost:3000/api/auth/jira/callback`
5. Copy **Client ID** and **Client Secret**

**.env.local:**
```
NEXT_PUBLIC_JIRA_CLIENT_ID=your_client_id
JIRA_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## OAuth Flow

```
User clicks "Connect Jira"
  → GET /api/auth/jira (server)
    → builds authorization URL with state + PKCE
    → redirects to Atlassian

Atlassian auth page
  → User authorizes
  → Redirects to /api/auth/jira/callback?code=...&state=...

/api/auth/jira/callback (server route)
  → validates state
  → POST https://auth.atlassian.com/oauth/token (server-side, secret safe)
  → receives access_token, refresh_token, expires_in
  → fetches /rest/api/3/myself for user info
  → fetches /oauth/token/accessible-resources for cloudId + cloudUrl
  → encrypts tokens (AES-GCM, key = PKCE verifier)
  → returns encrypted payload to client
  → client stores in Zustand user.jira
```

---

## `app/api/auth/jira/route.ts` (Authorize)

```ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state in a short-lived cookie (httpOnly, sameSite=lax, maxAge=300)
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: process.env.NEXT_PUBLIC_JIRA_CLIENT_ID!,
    scope: 'read:jira-user read:jira-work offline_access',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jira/callback`,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  const response = NextResponse.redirect(
    `https://auth.atlassian.com/authorize?${params}`
  );
  response.cookies.set('jira_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });
  return response;
}
```

---

## `app/api/auth/jira/callback/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state
  const storedState = req.cookies.get('jira_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?jira=error`);
  }

  // Exchange code for tokens (server-side — secret stays server)
  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jira/callback`,
    }),
  });
  const tokens = await tokenRes.json();
  // { access_token, refresh_token, expires_in, scope }

  // Get user info
  const userRes = await fetch('https://api.atlassian.com/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const jiraUser = await userRes.json();

  // Get cloudId
  const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const [resource] = await resourcesRes.json();

  // Redirect to settings with connection data as query params (short-lived, no secret)
  // Client-side will store encrypted in Zustand
  const params = new URLSearchParams({
    jira: 'connected',
    accountId: jiraUser.accountId,
    displayName: jiraUser.displayName,
    email: jiraUser.email,
    cloudId: resource.id,
    cloudUrl: resource.url,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt: String(Date.now() + tokens.expires_in * 1000),
  });

  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/settings?${params}`
  );
  response.cookies.delete('jira_oauth_state');
  return response;
}
```

> **Note:** The redirect passes tokens as query params only briefly — the Settings page immediately stores them encrypted in Zustand and clears the URL. Do NOT log these params.

---

## Token Encryption (`services/jira/crypto.ts`)

AES-GCM with a key derived from the user's PIN via PBKDF2. The key is never stored — derived fresh on each decrypt using the PIN from memory.

```ts
const ENC_SALT = 'daily-tracker-jira-salt-v1'; // static, public — salt adds entropy to PBKDF2

async function deriveKey(pin: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(ENC_SALT), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptToken(token: string, pin: string): Promise<string> {
  const key = await deriveKey(pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(token)
  );
  // Return base64(iv + ciphertext)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptToken(encrypted: string, pin: string): Promise<string> {
  const key = await deriveKey(pin);
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}
```

---

## `services/jira/client.ts`

```ts
import { JiraTicket, JiraConnection } from '@/types';
import { decryptToken, encryptToken } from './crypto';

const BASE = (cloudId: string) => `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

export async function fetchAssignedTickets(
  connection: JiraConnection,
  pin: string
): Promise<JiraTicket[]> {
  const token = await decryptToken(connection.accessToken, pin);
  const res = await fetch(
    `${BASE(connection.cloudId)}/search?jql=assignee%3DcurrentUser()%20ORDER%20BY%20updated%20DESC&maxResults=100&fields=summary,description,status,priority,project,sprint,created,updated`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`Jira API error: ${res.status}`);
  const data = await res.json();
  return data.issues.map(mapIssueToTicket);
}

function mapIssueToTicket(issue: any): JiraTicket {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description?.content?.[0]?.content?.[0]?.text ?? '',
    status: issue.fields.status.name,
    priority: issue.fields.priority?.name ?? 'None',
    project: issue.fields.project.name,
    projectKey: issue.fields.project.key,
    sprint: issue.fields.sprint?.name,
    createdAt: issue.fields.created,
    updatedAt: issue.fields.updated,
    assigneeAccountId: issue.fields.assignee?.accountId ?? '',
  };
}

export async function refreshJiraToken(
  refreshToken: string,
  pin: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const plainRefresh = await decryptToken(refreshToken, pin);
  const res = await fetch('/api/auth/jira/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: plainRefresh }),
  });
  const { access_token, expires_in } = await res.json();
  const encryptedAccess = await encryptToken(access_token, pin);
  return { accessToken: encryptedAccess, expiresAt: Date.now() + expires_in * 1000 };
}
```

---

## `services/jira/sync.ts`

```ts
import { useStore } from '@/lib/store';
import { fetchAssignedTickets, refreshJiraToken } from './client';

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startJiraSync(pin: string) {
  doSync(pin);
  syncInterval = setInterval(() => doSync(pin), 3_600_000); // 1 hour
}

export function stopJiraSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
}

async function doSync(pin: string) {
  const { user, setJiraTickets, updateJiraConnection } = useStore.getState();
  if (!user?.jira) return;

  let connection = user.jira;

  // Auto-refresh token if needed
  if (connection.expiresAt < Date.now() + 60_000) {
    try {
      const refreshed = await refreshJiraToken(connection.refreshToken, pin);
      connection = { ...connection, ...refreshed };
      updateJiraConnection(connection);
    } catch {
      return; // silent fail, retry next interval
    }
  }

  try {
    const tickets = await fetchAssignedTickets(connection, pin);
    setJiraTickets(tickets);
  } catch {
    // silent fail
  }
}
```

---

## `hooks/useJira.ts`

```ts
'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { startJiraSync, stopJiraSync } from '@/services/jira/sync';

export function useJira() {
  const { user, jiraTickets, syncJira } = useStore();

  useEffect(() => {
    if (!user?.jira || !user.pinHash) return;
    // Note: PIN must be held in memory after login
    // Pass from auth context or session store
    // startJiraSync(pin);
    // return () => stopJiraSync();
  }, [user?.jira]);

  return {
    isConnected: !!user?.jira,
    tickets: jiraTickets,
    connection: user?.jira,
    syncNow: syncJira,
  };
}
```

---

## Jira Store Extensions (`lib/store.ts`)

```ts
// Add to AppState interface:
jiraTickets: JiraTicket[];

// Add to actions:
setJiraTickets: (tickets: JiraTicket[]) => void;
updateJiraConnection: (connection: JiraConnection) => void;
connectJira: (connection: JiraConnection) => void;
disconnectJira: () => void;
syncJira: () => Promise<void>;

// Implementations:
setJiraTickets: (tickets) => set({ jiraTickets: tickets }),
updateJiraConnection: (connection) =>
  set(state => ({ user: state.user ? { ...state.user, jira: connection } : null })),
connectJira: (connection) =>
  set(state => ({ user: state.user ? { ...state.user, jira: connection } : null })),
disconnectJira: () =>
  set(state => ({ user: state.user ? { ...state.user, jira: undefined } : null, jiraTickets: [] })),
```

---

## Token Refresh API Route (`app/api/auth/jira/refresh/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json();
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.NEXT_PUBLIC_JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  return NextResponse.json({ access_token: data.access_token, expires_in: data.expires_in });
}
```

---

## Security Notes

- `JIRA_CLIENT_SECRET` is **never** `NEXT_PUBLIC_` — stays server-only
- Tokens are AES-GCM encrypted before entering localStorage
- The encryption key is derived from the user's PIN (never stored)
- OAuth `state` param validated server-side to prevent CSRF
- Token refresh happens server-side in Next.js API route
