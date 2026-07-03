# Daily Tracker - AI Coding Agent Guide

**Daily Tracker** is a Progressive Web App (PWA) for agile teams to prepare Daily Scrum meetings. It's a mobile-first, French-localized application built with Next.js 14, TypeScript, React 18, and Tailwind CSS.

## 🚀 Quick Start

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
npm run type-check # TypeScript verification
```

## 🏗️ Project Architecture

### Folder Structure

- **`app/`** — Next.js App Router, pages + API routes
  - `app/daily-meeting/`, `app/dashboard/`, `app/history/`, `app/reports/`, `app/settings/`, `app/jira-connect/`, `app/timeblocking/`
  - `app/api/auth/jira/` — Jira OAuth 2.0 flow
  - `app/api/entries/`, `app/api/jira/`, `app/api/notifications/`, `app/api/users/`
- **`components/`** — Organized by concern:
  - `ui/` — Reusable components (button, card, input, select, modal, progress, badge)
  - `features/` — Domain-specific components (daily-meeting-view, task-form, task-card, calendar-view, charts)
  - `layout/` — App structure (navigation, app-layout)
- **`lib/`** — Core logic: Zustand store, utilities, calculations, timeblocking
- **`services/`** — Centralized API client (ApiService with `ApiResponse<T>` wrapper)
- **`types/`** — Shared TypeScript definitions
- **`public/`** — PWA manifest, service worker

### State Management

Single Zustand store in [`lib/store.ts`](lib/store.ts) with `persist` middleware → localStorage.

**Common Actions:**
- Auth: `loginWithGoogle()`, `logout()`
- Entries: CRUD for daily tasks, validation, blockers
- Gamification: streak tracking, badge checking, XP calculation
- Jira: connection management, ticket planning, schedule freezing

Use `const { action } = useStore()` in components.

## 🎨 Development Patterns

### Components

```typescript
// Use 'use client' for interactive components
'use client';

interface Props {
  label: string;
  onClick: () => void;
}

export function MyComponent({ label, onClick }: Props) {
  // Destructure props, use Tailwind + clsx + CVA for styling
  return <button className={cn('...', className)}>{label}</button>;
}
```

### API Routes & Responses

All endpoints return `{ success: boolean, data?: T, error?: string }`.

**Example** (POST endpoint):
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  // Process...
  return Response.json({ success: true, data: result });
}
```

### Dates

- **Storage**: ISO format `YYYY-MM-DD` (strings)
- **Display**: French locale via `date-fns`
- Use `date-fns` for all date manipulation

### Types & Constants

- **Const enums** for categories, durations, badge types
- Keep types in [`types/index.ts`](types/index.ts)
- Example categories: work, learning, admin, meeting, break, health, personal, other (with emoji, French labels)

## 🔗 Key Integrations

### Jira OAuth 2.0

Authentication flow in [`app/api/auth/jira/`](app/api/auth/jira/):
1. **Initiate** — Generates CSRF state token, redirects to Atlassian auth page
2. **Callback** — Validates state, exchanges auth code for access token
3. **Cloud ID** — Fetches accessible resources, filters for Jira (not Confluence)
4. **Store** — Saves connection with tokens, user info, expiration time

**Scopes**: `read:jira-user read:jira-work write:jira-work offline_access read:account`

**Key Files**:
- [`app/api/auth/jira/route.ts`](app/api/auth/jira/route.ts) — Init
- [`app/api/auth/jira/callback/route.ts`](app/api/auth/jira/callback/route.ts) — Callback
- [`app/jira-connect/page.tsx`](app/jira-connect/page.tsx) — Connection UI

### Google Authentication

Users authenticate exclusively via Google OAuth 2.0. No PIN or password is stored.

**Flow**:
1. User clicks "Continuer avec Google" on the login page
2. Redirected to `/api/auth/google` — generates CSRF state token, redirects to Google
3. Google redirects to `/api/auth/google/callback` — validates state, exchanges code for access token, fetches user profile
4. User info (googleId, email, name, avatar) written to a short-lived `google_session` cookie
5. Redirected to `/` — login page claims session via `/api/auth/google/session`
6. `loginWithGoogle()` store action creates or updates the user, sets `isAuthenticated = true`
7. Redirected to `/dashboard`

**Key Files**:
- [`app/api/auth/google/route.ts`](app/api/auth/google/route.ts) — OAuth initiation
- [`app/api/auth/google/callback/route.ts`](app/api/auth/google/callback/route.ts) — OAuth callback
- [`app/api/auth/google/session/route.ts`](app/api/auth/google/session/route.ts) — Session claim

**Environment variables required**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Push Notifications

Web Push API via service worker ([`public/sw.js`](public/sw.js)). Configured in settings, triggered by API.

### Cloud Storage

Vercel Blob (`@vercel/blob`) for PDF exports. Used in reports generation.

## 📋 Common Tasks

### Adding a New Page

1. Create `app/new-feature/page.tsx`
2. Add navigation link in [`components/layout/navigation.tsx`](components/layout/navigation.tsx)
3. Use layout in [`components/layout/app-layout.tsx`](components/layout/app-layout.tsx)
4. Fetch store data with `const { data } = useStore()`

### Adding a New Feature Component

1. Create in `components/features/my-feature.tsx`
2. Use `'use client'` directive
3. Export from [`components/features/index.ts`](components/features/index.ts)
4. Import in page: `import { MyFeature } from '@/components/features'`

### Adding an API Endpoint

1. Create `app/api/new-endpoint/route.ts`
2. Return `{ success, data, error }` wrapper
3. Use `ApiService` in frontend for type-safe calls
4. Test with `npm run type-check`

### Modifying Store Logic

1. Edit [`lib/store.ts`](lib/store.ts) — Keep it single file for simplicity
2. Add action, update TypeScript types
3. Persist automatically via middleware
4. Update affected components that use the state

## 🎮 Gamification System

- **Streak**: Consecutive days with validated entries
- **Levels**: Based on XP (earned per day, per badge)
- **Badges**: Achievement-based (first entry, 7-day streak, 100+ entries, etc.)
- **Variants**: Track progress for each badge type

Calculation logic in [`lib/calculations.ts`](lib/calculations.ts).

## 🌍 Localization

All user-facing text is **French**:
- Category labels: "Travail", "Apprentissage", "Administration", etc.
- Date display: `formatDate(date, 'dd MMMM yyyy', { locale: fr })`
- Error messages, labels, placeholders
- Keep translation strings in types/constants, not hardcoded

## 📊 Features Overview

| Feature | Files | Purpose |
|---------|-------|---------|
| **Dashboard** | `app/dashboard/`, `components/features/category-chart.tsx`, `weekly-chart.tsx` | Task overview by category, stats |
| **Daily Meeting** | `app/daily-meeting/`, `components/features/daily-meeting-view.tsx` | Optimized presentation view (yesterday, today, blockers) |
| **Timeblocking** | `app/timeblocking/`, `lib/timeblocking.ts`, `components/features/timeblocking-calendar.tsx` | Schedule with Jira ticket integration |
| **History** | `app/history/`, `components/features/day-validation.tsx` | Calendar view, modify past entries |
| **Reports** | `app/reports/` | PDF export with task breakdown (Vercel Blob) |
| **Jira** | `app/jira-connect/`, `app/api/jira/`, integration throughout | Ticket planning, worklog sync |
| **Notifications** | `app/api/notifications/`, `public/sw.js` | Push notifications config |

## 🐛 Common Pitfalls & Tips

1. **Date Handling**: Always store as `YYYY-MM-DD` strings, format with `date-fns` for display. Never hardcode English date strings.
2. **Type Safety**: Run `npm run type-check` before committing. Use strict TypeScript mode.
3. **Store Updates**: Zustand merges state — partial updates work automatically. No need for reducers.
4. **Component Props**: Always destructure and type props explicitly; avoid spreading unknown props.
5. **Styling**: Use Tailwind first, CVA for complex component variants, `clsx`/`tailwind-merge` for conditional classes.
6. **API Errors**: Always check `success` flag and handle `error` field in responses.
7. **PWA Service Worker**: Keep [`public/sw.js`](public/sw.js) lightweight; lazy-load routes.
8. **Jira Token Refresh**: OAuth tokens have expiration; implement refresh logic for long-lived sessions.

## 📝 Code Quality

- **Linting**: ESLint config via `eslint-config-next`
- **TypeScript**: Strict mode enabled, check with `npm run type-check`
- **Formatting**: Use Tailwind CSS utilities, no custom CSS unless necessary
- **Testing**: No Jest/Vitest configured; focus on integration testing via Playwright or manual testing

## 🔄 Git Workflow

- Branch naming: `feature/feature-name`, `fix/bug-name`, `docs/doc-name`
- Commit messages: Clear, descriptive (e.g., "feat: add Jira ticket filtering to timeblocking")
- Pull requests: Link related issues, describe changes, test locally before pushing

## 📚 Documentation Links

- [README.md](README.md) — Project overview & architecture diagram
- [app/daily-meeting/README.md](app/daily-meeting/README.md) — Daily meeting feature spec
- [app/dashboard/README.md](app/dashboard/README.md) — Dashboard feature spec
- [app/history/README.md](app/history/README.md) — History feature spec
- [app/reports/README.md](app/reports/README.md) — Reports feature spec
- [app/settings/README.md](app/settings/README.md) — Settings feature spec

## 🤖 Agent Tips

- **Always run `npm run type-check`** after code changes to catch type errors early.
- **Test locally with `npm run dev`** before pushing.
- **Check existing patterns** in similar components before creating new ones.
- **Use the store as source of truth** — avoid prop drilling, lift state to store if needed across distant components.
- **French-first**: Assume all labels, messages, date displays are in French unless told otherwise.
- **PWA considerations**: All features should work offline (with cached assets) or gracefully degrade.
