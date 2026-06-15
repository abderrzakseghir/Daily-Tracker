---
name: jira-pin-integration
description: 'Implement PIN authentication and Jira OAuth 2.0 integration in the Daily Tracker Next.js app. Use when: adding PIN login, creating user accounts with PIN, connecting Jira account, syncing Jira tickets, adding Jira task selector, showing Jira badges in daily meeting, building Jira history page, Jira statistics, enriched PDF export, Jira dashboard card, smart Jira notifications, auth service, jira service, useAuth hook, useJira hook.'
argument-hint: 'feature to implement (e.g. "auth", "jira-sync", "task-selector", "all")'
---

# Jira + PIN Authentication — Daily Tracker

## What This Skill Produces

A complete, secure, mobile-first feature set extending the existing Daily Tracker app:

1. **PIN Authentication** — welcome screen, login, account creation, persistent session
2. **Jira OAuth 2.0** — connect personal Jira account in Settings
3. **Jira Sync Service** — auto-sync on startup + every hour
4. **Jira Task Selector** — choose "Free task" vs "Jira ticket" when adding a task
5. **Jira Badges in Daily** — `[PROJ-123]` badge in daily meeting summary
6. **Jira History Page** — `/jira` page with filters + search
7. **Jira Statistics** — charts by project, status, declared time
8. **Enriched PDF Export** — Jira columns in the export table
9. **Jira Dashboard Card** — card on homepage with ticket counters
10. **Smart Notifications** — prompt user to link Jira tickets at day validation

## Tech Stack Constraints

- Next.js 14+ App Router (existing codebase)
- Zustand + `persist` middleware (existing store at `lib/store.ts`)
- Tailwind CSS + existing `components/ui/`
- **No paid dependencies**
- `localStorage` for session persistence
- Jira REST API v3 (free, Cloud)

---

## Architecture Overview

```
/services/auth.ts          ← PIN hash, session management
/services/jira/
  client.ts                ← Jira REST API wrapper (OAuth 2.0 tokens)
  sync.ts                  ← Auto-sync logic (startup + interval)
  oauth.ts                 ← OAuth 2.0 flow helpers

/hooks/useAuth.ts          ← auth state + actions
/hooks/useJira.ts          ← jira data + sync trigger

/components/jira/
  JiraBadge.tsx            ← [PROJ-123] badge component
  JiraSelector.tsx         ← searchable ticket dropdown
  JiraCard.tsx             ← dashboard summary card
  JiraStats.tsx            ← statistics charts

/app/jira/page.tsx         ← Jira history page
/app/settings/page.tsx     ← extended with Jira section (existing file)
/app/page.tsx              ← extended with Jira card (existing file)
```

See [Auth Reference](./references/auth.md) and [Jira Reference](./references/jira.md) for detailed implementation.

---

## Implementation Procedure

### Step 1 — Extend Types (`types/index.ts`)

Add to existing types:

```ts
// PIN Auth
export interface User {
  // ... existing fields ...
  pinHash: string;           // bcryptjs hash of 4-6 digit PIN
  jira?: JiraConnection;
}

export interface JiraConnection {
  accountId: string;
  displayName: string;
  email: string;
  cloudId: string;
  cloudUrl: string;
  accessToken: string;       // encrypted via Web Crypto API
  refreshToken: string;      // encrypted
  expiresAt: number;         // Unix timestamp
}

// Jira Ticket
export interface JiraTicket {
  key: string;               // "PROJ-123"
  summary: string;
  description?: string;
  status: string;
  priority: string;
  project: string;
  projectKey: string;
  sprint?: string;
  createdAt: string;
  updatedAt: string;
  assigneeAccountId: string;
}

// Task extension
export interface Task {
  // ... existing fields ...
  taskType: 'free' | 'jira';
  jiraKey?: string;          // "PROJ-123"
  jiraTicket?: JiraTicket;   // denormalized snapshot
}
```

### Step 2 — PIN Auth Service (`services/auth.ts`)

See [Auth Reference](./references/auth.md).

Key points:
- Use `bcryptjs` (free, no native deps) to hash PIN
- Store hash in Zustand `persist` (localStorage)
- Session token = `crypto.randomUUID()` stored in `sessionStorage`
- `comparePin(pin, hash)` → boolean

### Step 3 — Auth Store Extension (`lib/store.ts`)

Extend existing Zustand store:
- `login(pin)` → hash compare, set `isAuthenticated = true`, write session token
- `logout()` → clear session token, `isAuthenticated = false`
- `createUser(firstName, lastName, pin)` → hash PIN, persist user
- On app boot: check `sessionStorage` token → auto-restore session

### Step 4 — Welcome / Login Screen (`app/page.tsx` or new `app/auth/page.tsx`)

- If `!isAuthenticated`: render `<AuthScreen />`
- `<AuthScreen />` has two tabs: **Login** (PIN field) and **Create account** (name + PIN + confirm)
- After successful login/create → redirect to `/dashboard`
- Style: Linear/Notion aesthetic, mobile-first, minimal

### Step 5 — Jira OAuth 2.0 Setup

See [Jira Reference](./references/jira.md).

Required env vars (`.env.local`):
```
NEXT_PUBLIC_JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

OAuth flow:
1. User clicks "Connect Jira" in Settings
2. Redirect to Jira authorization URL
3. Jira redirects back to `/api/auth/jira/callback`
4. Exchange code for tokens → encrypt → store in user's `jira` field
5. Display connection status in Settings

### Step 6 — Jira API Service (`services/jira/client.ts`)

- `getAssignedTickets(cloudId, accessToken)` → `JiraTicket[]`
- `refreshAccessToken(refreshToken)` → new tokens
- Auto-refresh if `expiresAt < Date.now()`
- REST endpoint: `GET /rest/api/3/search?jql=assignee=currentUser()&maxResults=100`

### Step 7 — Sync Service (`services/jira/sync.ts`)

```ts
// Called from useJira hook
startJiraSync()  // triggers on mount if Jira connected
stopJiraSync()   // cleanup on unmount

// Internally:
// - immediate fetch on start
// - setInterval every 3600_000 ms
// - store tickets in Zustand (jiraTickets: JiraTicket[])
```

### Step 8 — Jira Task Selector (`components/jira/JiraSelector.tsx`)

In `components/features/task-form.tsx`:
- Add radio/toggle: **Tâche libre** | **Ticket Jira**
- When "Ticket Jira" selected: show `<JiraSelector />` (combobox)
- Combobox filters `jiraTickets` by key + summary on each keystroke
- On select: pre-fill `description`, `project` field, auto-map `category`
- Fields remain editable after pre-fill

### Step 9 — Jira Badge in Daily (`components/jira/JiraBadge.tsx`)

In `components/features/daily-meeting-view.tsx` and `components/features/task-card.tsx`:
- If `task.taskType === 'jira'` && `task.jiraKey`: render `<JiraBadge jiraKey={task.jiraKey} />`
- Badge style: monospace, colored border, linear style
- Example: `[PROJ-123]`

### Step 10 — Jira History Page (`app/jira/page.tsx`)

- Filter tabs: Tous | Ouverts | En cours | Terminés
- Search bar: key, project, keyword (client-side filter on `jiraTickets`)
- List item: key badge + summary + status chip + priority + project
- Pull from Zustand `jiraTickets`

### Step 11 — Jira Statistics (`components/jira/JiraStats.tsx`)

Add to `/app/reports/page.tsx` or a new tab:
- Tickets count: week / month / year (filter by `updatedAt`)
- Bar chart by project (use existing `recharts` or `components/features/category-chart.tsx` pattern)
- Pie/donut chart by status
- Declared time (if `timeSpent` from Jira API)

### Step 12 — Dashboard Card (`components/jira/JiraCard.tsx`)

Add to `/app/dashboard/page.tsx`:
- Title "Mes tickets Jira"
- 3 counters: Assignés | En cours | Terminés cette semaine
- "Synchroniser" button → calls `syncJira()`

### Step 13 — Settings Jira Section (`app/settings/page.tsx`)

Extend existing settings page:
- Section "Connexion Jira"
- Status pill: Connecté (green) / Non connecté (gray)
- Button: "Connecter mon compte Jira" or "Déconnecter"
- Shows: displayName, email, cloudUrl when connected
- "Synchroniser maintenant" button

### Step 14 — Smart Notifications

In `components/features/day-validation.tsx`:
- After user clicks "Valider la journée"
- Check: `jiraTickets.length > 0 && todayTasks.filter(t => t.taskType === 'jira').length === 0`
- If true: show modal/toast "Vous avez X tickets assignés. Voulez-vous en associer un ?"
- Buttons: Oui (open task form pre-filtered) | Ignorer (proceed with validation)

### Step 15 — PDF Export Enhancement

In the existing PDF export logic (search for `pdf` or `export` in codebase):
- Add columns: Ticket Jira | Projet | Statut
- Row data: `task.jiraKey ?? '—'`, `task.jiraTicket?.project ?? '—'`, `task.jiraTicket?.status ?? '—'`

---

## Security Checklist

- [ ] PIN never stored in plain text — always `bcryptjs` hash
- [ ] Jira `accessToken` and `refreshToken` encrypted with Web Crypto API (AES-GCM) before localStorage
- [ ] Encryption key derived from PIN via PBKDF2 (never stored)
- [ ] `JIRA_CLIENT_SECRET` only in server-side env (no `NEXT_PUBLIC_` prefix)
- [ ] OAuth callback validates `state` param to prevent CSRF
- [ ] Token refresh happens server-side in API route

---

## See Also

- [Auth Implementation Details](./references/auth.md)
- [Jira OAuth + API Details](./references/jira.md)
- [Full Feature Checklist](./references/features.md)
