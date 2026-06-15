# Full Feature Checklist

Use this as a step-by-step implementation tracker. Complete in order — later items depend on earlier ones.

---

## Phase 1 — Foundation

### 1.1 Dependencies
- [ ] `npm install bcryptjs`
- [ ] `npm install --save-dev @types/bcryptjs`
- [ ] Verify existing deps: `zustand`, `recharts` (or similar chart lib)

### 1.2 Types (`types/index.ts`)
- [ ] Add `pinHash: string` to `User` interface
- [ ] Add `firstName`, `lastName` to `User` (if not present)
- [ ] Add `jira?: JiraConnection` to `User`
- [ ] Create `JiraConnection` interface
- [ ] Create `JiraTicket` interface
- [ ] Extend `Task` with `taskType: 'free' | 'jira'`, `jiraKey?`, `jiraTicket?`

### 1.3 Store (`lib/store.ts`)
- [ ] Add `jiraTickets: JiraTicket[]` to state
- [ ] Add `setAuthenticated(v: boolean)` action
- [ ] Extend `login(pin)` to use `verifyPin` from `services/auth`
- [ ] Extend `createUser` to accept `firstName`, `lastName`, hash PIN
- [ ] Add `setJiraTickets`, `updateJiraConnection`, `connectJira`, `disconnectJira` actions

---

## Phase 2 — PIN Authentication

### 2.1 Services
- [ ] Create `services/auth.ts` with `hashPin`, `verifyPin`, `createSession`, `getSession`, `clearSession`, `validatePin`

### 2.2 Hook
- [ ] Create `hooks/useAuth.ts`

### 2.3 UI
- [ ] Create `components/features/auth-screen.tsx` with Login + Register tabs
- [ ] `LoginForm`: PIN input (numeric, 4-6 digits), error state, submit
- [ ] `RegisterForm`: firstName, lastName, PIN, confirm PIN, error states
- [ ] Add PIN input UX: large digit display, numeric keyboard hint
- [ ] Add to `app/layout.tsx` or `app/page.tsx`: if `!isAuthenticated` → `<AuthScreen />`

### 2.4 Session Restore
- [ ] Add `AuthGuard` component that checks `sessionStorage` on mount
- [ ] Add logout button in navigation (`components/layout/navigation.tsx`)

---

## Phase 3 — Jira Foundation

### 3.1 Env Setup
- [ ] Create `.env.local` with `NEXT_PUBLIC_JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
- [ ] Register app at https://developer.atlassian.com/console/myapps/

### 3.2 Crypto Service
- [ ] Create `services/jira/crypto.ts` with `encryptToken`, `decryptToken` (AES-GCM + PBKDF2)

### 3.3 API Routes
- [ ] Create `app/api/auth/jira/route.ts` (authorize redirect)
- [ ] Create `app/api/auth/jira/callback/route.ts` (token exchange)
- [ ] Create `app/api/auth/jira/refresh/route.ts` (token refresh)

### 3.4 Jira Client
- [ ] Create `services/jira/client.ts` with `fetchAssignedTickets`, `refreshJiraToken`

### 3.5 Sync Service
- [ ] Create `services/jira/sync.ts` with `startJiraSync`, `stopJiraSync`, `doSync`
- [ ] Create `services/jira/index.ts` (barrel export)

### 3.6 Hook
- [ ] Create `hooks/useJira.ts`
- [ ] Update `hooks/index.ts` to export `useAuth` and `useJira`

---

## Phase 4 — Jira UI Components

### 4.1 Badge
- [ ] Create `components/jira/JiraBadge.tsx`
  - Props: `jiraKey: string`, optional `summary?: string`
  - Style: monospace font, rounded border, small text
  - Example output: `[PROJ-123]`

### 4.2 Selector
- [ ] Create `components/jira/JiraSelector.tsx`
  - Searchable combobox (filter by key + summary)
  - Shows max 20 results, scrollable
  - Item format: `PROJ-123 — Summary text`
  - On select: calls `onSelect(ticket: JiraTicket)`

### 4.3 Dashboard Card
- [ ] Create `components/jira/JiraCard.tsx`
  - 3 stat counters: Assignés / En cours / Terminés cette semaine
  - "Synchroniser" button
  - Loading skeleton

### 4.4 Stats
- [ ] Create `components/jira/JiraStats.tsx`
  - Reuse `components/features/category-chart.tsx` pattern
  - Chart 1: tickets by project (bar)
  - Chart 2: tickets by status (pie/donut)
  - Counters: week / month / year
- [ ] Create `components/jira/index.ts` (barrel export)

---

## Phase 5 — Feature Integration

### 5.1 Task Form (`components/features/task-form.tsx`)
- [ ] Add `taskType` radio/toggle: "Tâche libre" | "Ticket Jira"
- [ ] Show `<JiraSelector />` when `taskType === 'jira'` and `isConnected`
- [ ] On ticket select: auto-fill `description`, set `jiraKey`, map `category`
- [ ] Keep all fields editable after pre-fill
- [ ] If Jira not connected: show "Connecter Jira" link in ticket option

### 5.2 Task Card (`components/features/task-card.tsx`)
- [ ] If `task.jiraKey`: render `<JiraBadge />` next to task title

### 5.3 Daily Meeting (`components/features/daily-meeting-view.tsx`)
- [ ] For each task with `jiraKey`: show `<JiraBadge jiraKey={...} summary={...} />`

### 5.4 Day Validation (`components/features/day-validation.tsx`)
- [ ] After validation click: check if jira connected + no jira tasks today
- [ ] If true: show prompt modal "Vous avez X tickets assignés..."
- [ ] Modal buttons: "Associer un ticket" (open task form) | "Ignorer"

---

## Phase 6 — Pages

### 6.1 Settings (`app/settings/page.tsx`)
- [ ] Add "Connexion Jira" section
- [ ] Show status pill: Connecté (green) / Non connecté (gray)
- [ ] Show: displayName, email, cloudUrl when connected
- [ ] Button: "Connecter mon compte Jira" → GET `/api/auth/jira`
- [ ] Button: "Déconnecter" → `disconnectJira()`
- [ ] Button: "Synchroniser maintenant" → `syncNow()`
- [ ] Handle `?jira=connected` callback: extract params, encrypt tokens, store, clear URL

### 6.2 Dashboard (`app/dashboard/page.tsx`)
- [ ] Add `<JiraCard />` component
- [ ] Position: after existing summary cards

### 6.3 Jira History (`app/jira/page.tsx`)
- [ ] Create page with filter tabs: Tous | Ouverts | En cours | Terminés
- [ ] Search bar: real-time filter on key + project + summary
- [ ] List: ticket item with key badge, summary, status chip, priority, project, updated date
- [ ] Empty state: "Connectez votre compte Jira" link to settings

### 6.4 Reports / Statistics (`app/reports/page.tsx`)
- [ ] Add Jira stats section or tab
- [ ] Include `<JiraStats />`

### 6.5 Navigation (`components/layout/navigation.tsx`)
- [ ] Add "Mes tickets Jira" nav item (icon: ticket/tag) pointing to `/jira`
- [ ] Add logout button/menu item

---

## Phase 7 — PDF Export

- [ ] Find existing PDF export logic (search for `jsPDF`, `pdf`, or `print` in codebase)
- [ ] Add columns: Ticket Jira | Projet | Statut
- [ ] Map from `task.jiraKey`, `task.jiraTicket?.project`, `task.jiraTicket?.status`
- [ ] Fallback: `—` when no Jira data

---

## Phase 8 — Polish

- [ ] Loading skeletons for Jira data (Jira card, selector, history list)
- [ ] Error states (Jira API unreachable, token expired)
- [ ] Empty states with clear CTAs
- [ ] Mobile layout: bottom sheet for Jira selector on small screens
- [ ] Dark mode: verify all new components work with existing dark theme
- [ ] Accessibility: ARIA labels on badge, combobox keyboard navigation

---

## Definition of Done

- [ ] User can create account and log in with PIN
- [ ] Session persists across page reload; clears on tab close
- [ ] User can connect Jira, see connected status in Settings
- [ ] Tickets sync on app start and every hour
- [ ] "Ajouter une tâche" flow: choose Ticket Jira → search → select → pre-filled → save in < 30s
- [ ] Jira badge `[PROJ-123]` appears in daily meeting view
- [ ] `/jira` page shows history with filters
- [ ] Dashboard shows Jira card
- [ ] Day validation shows Jira reminder if no ticket linked
- [ ] PDF export includes Jira columns
- [ ] No plain-text tokens in localStorage
- [ ] All new components pass existing lint/type checks
