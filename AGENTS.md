# Daily Tracker - AI Coding Agent Guide

**Daily Tracker** is a Progressive Web App (PWA) for agile teams to prepare Daily Scrum meetings. It's a mobile-first, French-localized application built with Next.js 14, TypeScript, React 18, and Tailwind CSS.

## 🚀 Quick Start

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
npm run type-check # TypeScript verification
npm test           # Vitest unit + API tests
```

## 🏗️ Project Architecture

### Folder Structure

- **`app/`** — Next.js App Router pages + API routes
  - Pages: `/` (login), `/dashboard` (today), `/day/[date]`, `/planning`, `/history`, `/reports`, `/daily-meeting`, `/settings`
  - `app/api/auth/{google,jira,logout}` — OAuth flows + session
  - `app/api/{me,days,tasks,templates,jira,search,export,import,push,cron,health}`
- **`components/`**
  - `ui/` — primitives (button, card, modal, toaster, controls: PointsPicker, Switch, Segmented…)
  - `features/` — calendar-grid, day-view, task-editor, task-item, quick-add, jira-*, focus-timer, report-charts
  - `layout/` — navigation, app-layout (`AppLayout`, `PageHeader`)
- **`lib/`**
  - `planner.ts` — pure points → duration → schedule algorithm (shared client/server, unit-tested)
  - `quick-add.ts` — natural-language task parser
  - `dates.ts`, `stats.ts`, `utils.ts`
  - `store.ts` — Zustand **UI-only** state (toasts, focus timer, view prefs)
  - `client/` — `api()` fetch wrapper, SWR hooks + optimistic actions (`data.ts`)
  - `server/` — server-only: `env` (canonical APP_URL), `session` (HMAC cookie), `supabase`, `jira`, `repo`, `tasks`, `http`
- **`supabase/schema.sql`** — database schema (run once in Supabase SQL editor)
- **`types/index.ts`** — shared types & constants

### Data flow

- **Source of truth = Supabase** (Postgres). Routes use the `service_role` key; RLS is enabled with no policies, so the anon key can read nothing.
- Auth = Google OAuth → signed `dt_session` cookie (30 days). `middleware.ts` guards pages; API routes use `withUser()` from `lib/server/http.ts`.
- Every task mutation calls `replanDay()` server-side: recompute durations/start times, persist, then sync Jira worklogs if `autoSyncWorklog`.
- Client: SWR range keys `/api/days?from=&to=`; mutations update every cached range optimistically (re-planned locally with `applyPlan`) and are replaced by the server response.
- Jira tokens never reach the browser; they are refreshed in `lib/server/jira.ts`.
- OAuth `redirect_uri` is always built from `APP_URL` (`lib/server/env.ts`) — never from the request origin.

## 🎨 Development Patterns

- Interactive components use `'use client'`, typed destructured props, Tailwind + `cn()`.
- API routes: wrap with `withUser(async (req, { userId, params }) => ok(data))`; throw `HttpError(status, message)` for user errors (French messages).
- Dates are `YYYY-MM-DD` strings computed on the client (`lib/dates.ts`, date-fns `fr` locale).
- Category colors come from a CVD-validated palette in `types/index.ts` (fixed order — do not reorder).
- Tests: `npm test` (vitest). `lib/__tests__/fake-supabase.ts` is an in-memory Supabase used to test real route handlers.

## 🎮 Gamification System

- **Streak**: consecutive validated workdays (`computeStreak` in [`lib/stats.ts`](lib/stats.ts)), shown on the day view and history.

## 🌍 Localization

All user-facing text is **French**:
- Category labels in `CATEGORY_LABELS` (types/index.ts)
- Date display: `fmt(date, 'EEEE d MMMM')` from `lib/dates.ts` (date-fns, `fr` locale)
- Error messages, labels, placeholders
- Keep translation strings in types/constants, not hardcoded

## 📊 Features Overview

| Feature | Files | Purpose |
|---------|-------|---------|
| **Day** | `app/dashboard/`, `app/day/[date]/`, `components/features/day-view.tsx` | Quick add, reorderable list, day agenda, mood/blockers/notes, validation |
| **Planning** | `app/planning/`, `components/features/calendar-grid.tsx`, `lib/planner.ts` | Week calendar, drag & drop / resize task cards |
| **Jira** | `lib/server/jira.ts`, `lib/server/repo.ts` (`syncWorklog`), `app/api/jira/*`, `components/features/jira-*` | Create/link issues, import, automatic worklogs |
| **History** | `app/history/`, `app/api/search/` | Month heatmap, streaks, search, edit past days |
| **Reports** | `app/reports/`, `components/features/report-charts.tsx` | Charts (chart.js), table view, PDF/CSV export |
| **Daily Meeting** | `app/daily-meeting/` | Yesterday / today / blockers, present mode, copy for Slack |
| **Focus & reminders** | `components/features/focus-timer.tsx`, `app/api/push/`, `app/api/cron/reminder/`, `public/sw.js` | Pomodoro timer, end-of-day push reminder |

## 🐛 Common Pitfalls & Tips

1. **Date Handling**: Always store as `YYYY-MM-DD` strings, format with `date-fns` for display. Never hardcode English date strings.
2. **Type Safety**: Run `npm run type-check` before committing. Use strict TypeScript mode.
3. **Data**: never persist business data in Zustand/localStorage — go through the API + `lib/client/data.ts` actions.
4. **Component Props**: Always destructure and type props explicitly; avoid spreading unknown props.
5. **Styling**: Use Tailwind first, CVA for complex component variants, `clsx`/`tailwind-merge` for conditional classes.
6. **API Errors**: Always check `success` flag and handle `error` field in responses.
7. **PWA Service Worker**: Keep [`public/sw.js`](public/sw.js) lightweight; lazy-load routes.
8. **Jira**: always call Jira through `jiraFetch()` (auto refresh of rotating refresh tokens). Never expose tokens to the client.
9. **OAuth URLs**: build redirect URIs with `googleRedirectUri()` / `jiraRedirectUri()` — never `req.nextUrl.origin`.

## 📝 Code Quality

- **Linting**: ESLint config via `eslint-config-next`
- **TypeScript**: Strict mode enabled, check with `npm run type-check`
- **Formatting**: Use Tailwind CSS utilities, no custom CSS unless necessary
- **Testing**: Vitest (`npm test`) — planner, quick-add parser, API routes against an in-memory Supabase with mocked Jira

## 🔄 Git Workflow

- Branch naming: `feature/feature-name`, `fix/bug-name`, `docs/doc-name`
- Commit messages: Clear, descriptive (e.g., "feat: add Jira ticket filtering to timeblocking")
- Pull requests: Link related issues, describe changes, test locally before pushing

## 📚 Documentation Links

- [README.md](README.md) — Features, architecture, setup (Supabase, Google, Jira, Vercel)
- [supabase/schema.sql](supabase/schema.sql) — Database schema

## 🤖 Agent Tips

- **Always run `npm run type-check`** after code changes to catch type errors early.
- **Test locally with `npm run dev`** before pushing.
- **Check existing patterns** in similar components before creating new ones.
- **Supabase is the source of truth** — read with SWR hooks (`useDay`, `useRange`, `useMe`), write with the optimistic actions in `lib/client/data.ts`.
- **French-first**: Assume all labels, messages, date displays are in French unless told otherwise.
- **PWA considerations**: All features should work offline (with cached assets) or gracefully degrade.
