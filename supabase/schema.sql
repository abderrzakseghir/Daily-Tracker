-- ============================================================
-- Daily Tracker — schéma Supabase
-- À exécuter une fois dans Supabase › SQL Editor (idempotent).
--
-- Toutes les lectures/écritures passent par les routes API Next.js
-- avec la clé service_role : le RLS est activé SANS politique publique,
-- donc la clé anon ne peut rien lire. Les jetons Jira ne quittent jamais le serveur.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── Utilisateurs ───────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  google_id   text not null unique,
  email       text not null unique,
  name        text not null,
  avatar      text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_login_at timestamptz
);

-- ─── Connexion Jira (1 par utilisateur) ─────────────────────
create table if not exists public.jira_connections (
  user_id       uuid primary key references public.users(id) on delete cascade,
  account_id    text not null,
  display_name  text not null,
  email         text,
  avatar        text,
  cloud_id      text not null,
  cloud_url     text not null,
  site_name     text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Journées (métadonnées) ─────────────────────────────────
create table if not exists public.days (
  user_id      uuid not null references public.users(id) on delete cascade,
  date         date not null,
  blockers     text not null default '',
  notes        text not null default '',
  mood         smallint check (mood between 1 and 5),
  energy       smallint check (energy between 1 and 5),
  validated    boolean not null default false,
  validated_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, date)
);

-- ─── Tâches ─────────────────────────────────────────────────
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  date             date not null,
  title            text not null,
  description      text not null default '',
  category         text not null default 'development',
  points           smallint not null default 5 check (points between 1 and 10),
  status           text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  position         integer not null default 0,
  -- Durée saisie à la main (null = calculée à partir des points)
  manual_duration  integer check (manual_duration is null or manual_duration > 0),
  -- Durée effective et horaire, recalculés par le planificateur
  duration_minutes integer not null default 60,
  start_time       text,                       -- "HH:MM"
  pinned           boolean not null default false, -- horaire fixé à la main (glisser-déposer)
  actual_minutes   integer not null default 0, -- temps mesuré par le minuteur focus
  -- Synchronisation Jira
  jira_key         text,
  jira_url         text,
  jira_project_key text,
  jira_worklog_id  text,
  jira_synced_minutes integer,
  jira_synced_start text,                     -- "YYYY-MM-DD HH:MM" du dernier worklog envoyé
  jira_synced_at   timestamptz,
  jira_sync_error  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, date);
create index if not exists tasks_user_jira_idx on public.tasks (user_id, jira_key);

-- ─── Modèles de tâches récurrentes ──────────────────────────
create table if not exists public.task_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  category    text not null default 'meeting',
  points      smallint not null default 2 check (points between 1 and 10),
  manual_duration integer,
  start_time  text,
  -- jours ISO : 1 = lundi … 7 = dimanche ; vide = modèle manuel uniquement
  weekdays    smallint[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists task_templates_user_idx on public.task_templates (user_id);

-- ─── Abonnements push ───────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ─── RLS : tout est fermé à la clé anon ─────────────────────
alter table public.users              enable row level security;
alter table public.jira_connections   enable row level security;
alter table public.days               enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_templates     enable row level security;
alter table public.push_subscriptions enable row level security;
