import 'server-only';
import { db } from './supabase';
import { HttpError } from './http';
import type { JiraIssue, JiraProject } from '@/types';

/**
 * Accès à l'API Jira Cloud (OAuth 2.0 3LO) côté serveur.
 * Les jetons sont stockés dans Supabase et rafraîchis automatiquement
 * (Atlassian fait tourner le refresh_token : on enregistre toujours le nouveau).
 */

interface JiraConnectionRow {
  user_id: string;
  account_id: string;
  display_name: string;
  email: string | null;
  avatar: string | null;
  cloud_id: string;
  cloud_url: string;
  site_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export const JIRA_SCOPES =
  'read:jira-user read:jira-work write:jira-work offline_access read:account';

export async function getJiraConnection(userId: string): Promise<JiraConnectionRow | null> {
  const { data, error } = await db()
    .from('jira_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as JiraConnectionRow | null;
}

async function refreshTokens(conn: JiraConnectionRow): Promise<JiraConnectionRow> {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('[Jira] refresh failed', res.status, detail);
    throw new HttpError(400, 'La connexion Jira a expiré — reconnectez Jira dans les paramètres.');
  }
  const tokens = await res.json();
  const updated: Partial<JiraConnectionRow> = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? conn.refresh_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
  };
  await db()
    .from('jira_connections')
    .update({ ...updated, updated_at: new Date().toISOString() })
    .eq('user_id', conn.user_id);
  return { ...conn, ...updated };
}

async function freshConnection(userId: string): Promise<JiraConnectionRow> {
  const conn = await getJiraConnection(userId);
  if (!conn) throw new HttpError(400, "Jira n'est pas connecté.");
  if (new Date(conn.expires_at).getTime() - Date.now() < 60_000) {
    return refreshTokens(conn);
  }
  return conn;
}

export class JiraApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Jira ${status}: ${detail.slice(0, 300)}`);
  }
}

/** Requête authentifiée vers l'API Jira (rafraîchit le jeton une fois sur 401). */
export async function jiraFetch<T = unknown>(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let conn = await freshConnection(userId);
  const doFetch = (c: JiraConnectionRow) =>
    fetch(`https://api.atlassian.com/ex/jira/${c.cloud_id}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${c.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

  let res = await doFetch(conn);
  if (res.status === 401) {
    conn = await refreshTokens(conn);
    res = await doFetch(conn);
  }
  if (!res.ok) throw new JiraApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Message lisible pour l'utilisateur à partir d'une erreur Jira. */
export function jiraErrorMessage(err: unknown): string {
  if (err instanceof JiraApiError) {
    try {
      const body = JSON.parse(err.detail);
      const msgs = [
        ...(body.errorMessages ?? []),
        ...Object.values(body.errors ?? {}),
      ].filter(Boolean);
      if (msgs.length) return `Jira : ${msgs.join(' · ')}`;
    } catch {
      /* corps non JSON */
    }
    if (err.status === 403) return "Jira : permission refusée sur ce projet.";
    if (err.status === 404) return 'Jira : ticket introuvable.';
    return `Jira : erreur ${err.status}`;
  }
  return err instanceof Error ? err.message : 'Erreur Jira inconnue';
}

// ─── Lecture ──────────────────────────────────────────────────

export async function listProjects(userId: string): Promise<JiraProject[]> {
  const data = await jiraFetch<{ values: any[] }>(
    userId,
    '/rest/api/3/project/search?maxResults=100&orderBy=name',
  );
  return (data.values ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    avatar: p.avatarUrls?.['24x24'],
  }));
}

const ISSUE_FIELDS = [
  'summary',
  'status',
  'priority',
  'project',
  'issuetype',
  'updated',
  'timespent',
];

export async function searchIssues(userId: string, jql: string, max = 50): Promise<JiraIssue[]> {
  const conn = await freshConnection(userId);
  const data = await jiraFetch<{ issues: any[] }>(userId, '/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({ jql, maxResults: max, fields: ISSUE_FIELDS }),
  });
  return (data.issues ?? []).map((i) => mapIssue(i, conn.cloud_url));
}

export async function getIssue(userId: string, key: string): Promise<JiraIssue> {
  const conn = await freshConnection(userId);
  const i = await jiraFetch<any>(
    userId,
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${ISSUE_FIELDS.join(',')}`,
  );
  return mapIssue(i, conn.cloud_url);
}

function mapIssue(i: any, cloudUrl: string): JiraIssue {
  return {
    key: i.key,
    summary: i.fields?.summary ?? '',
    status: i.fields?.status?.name ?? '',
    statusCategory: i.fields?.status?.statusCategory?.key ?? 'new',
    priority: i.fields?.priority?.name ?? '',
    projectKey: i.fields?.project?.key ?? '',
    projectName: i.fields?.project?.name ?? '',
    issueType: i.fields?.issuetype?.name ?? '',
    url: `${cloudUrl}/browse/${i.key}`,
    updatedAt: i.fields?.updated ?? '',
    timeSpentSeconds: i.fields?.timespent ?? 0,
  };
}

// ─── Écriture ─────────────────────────────────────────────────

function adf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: text
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((para) => ({ type: 'paragraph', content: [{ type: 'text', text: para }] })),
  };
}

export async function pickIssueType(userId: string, projectKey: string): Promise<string> {
  const data = await jiraFetch<{ issueTypes?: any[]; values?: any[] }>(
    userId,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`,
  );
  const types = (data.issueTypes ?? data.values ?? []).filter((t) => !t.subtask);
  const preferred = types.find((t) => /^(task|tâche)$/i.test(t.name));
  const fallback = types.find((t) => !/epic|épopée/i.test(t.name)) ?? types[0];
  const chosen = preferred ?? fallback;
  if (!chosen) throw new HttpError(400, `Aucun type de ticket disponible dans ${projectKey}.`);
  return chosen.id;
}

/**
 * Crée un ticket assigné à l'utilisateur, avec estimation initiale.
 * Si le projet refuse certains champs (estimation, assignation), on réessaie
 * avec le strict minimum puis on assigne séparément.
 */
export async function createIssue(
  userId: string,
  input: {
    projectKey: string;
    summary: string;
    description?: string;
    estimateMinutes?: number;
    issueTypeId?: string;
  },
): Promise<{ key: string; url: string }> {
  const conn = await freshConnection(userId);
  const issueTypeId = input.issueTypeId ?? (await pickIssueType(userId, input.projectKey));

  const base: Record<string, unknown> = {
    project: { key: input.projectKey },
    summary: input.summary.slice(0, 250),
    issuetype: { id: issueTypeId },
    ...(input.description ? { description: adf(input.description) } : {}),
  };
  const full = {
    ...base,
    assignee: { accountId: conn.account_id },
    ...(input.estimateMinutes ? { timetracking: { originalEstimate: `${input.estimateMinutes}m` } } : {}),
  };

  let created: { key: string };
  try {
    created = await jiraFetch(userId, '/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify({ fields: full }),
    });
  } catch (err) {
    if (!(err instanceof JiraApiError) || err.status !== 400) throw err;
    created = await jiraFetch(userId, '/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify({ fields: base }),
    });
    await jiraFetch(userId, `/rest/api/3/issue/${created.key}/assignee`, {
      method: 'PUT',
      body: JSON.stringify({ accountId: conn.account_id }),
    }).catch((e) => console.warn('[Jira] assignation impossible', e));
  }
  return { key: created.key, url: `${conn.cloud_url}/browse/${created.key}` };
}

/** Calcule le décalage "+0100" d'un fuseau IANA à une date/heure donnée. */
function tzOffset(date: string, time: string, timeZone: string): string {
  try {
    const instant = new Date(`${date}T${time}:00Z`);
    const name =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(instant)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000';
  } catch {
    return '+0000';
  }
}

export function jiraStarted(date: string, time: string, timeZone: string): string {
  return `${date}T${time}:00.000${tzOffset(date, time, timeZone)}`;
}

/** Crée ou met à jour le worklog d'une tâche. Retourne l'id du worklog. */
export async function upsertWorklog(
  userId: string,
  input: { key: string; worklogId: string | null; minutes: number; started: string; comment?: string },
): Promise<string> {
  const body = JSON.stringify({
    timeSpentSeconds: Math.max(60, Math.round(input.minutes) * 60),
    started: input.started,
    ...(input.comment ? { comment: adf(input.comment) } : {}),
  });
  const base = `/rest/api/3/issue/${encodeURIComponent(input.key)}/worklog`;

  if (input.worklogId) {
    try {
      const wl = await jiraFetch<{ id: string }>(
        userId,
        `${base}/${input.worklogId}?adjustEstimate=auto`,
        { method: 'PUT', body },
      );
      return wl.id;
    } catch (err) {
      // Worklog supprimé côté Jira → on le recrée
      if (!(err instanceof JiraApiError) || err.status !== 404) throw err;
    }
  }
  const wl = await jiraFetch<{ id: string }>(userId, `${base}?adjustEstimate=auto`, {
    method: 'POST',
    body,
  });
  return wl.id;
}

export async function deleteWorklog(userId: string, key: string, worklogId: string) {
  try {
    await jiraFetch(
      userId,
      `/rest/api/3/issue/${encodeURIComponent(key)}/worklog/${worklogId}?adjustEstimate=auto`,
      { method: 'DELETE' },
    );
  } catch (err) {
    if (!(err instanceof JiraApiError) || err.status !== 404) throw err;
  }
}

/**
 * Met à jour titre, estimation et (si non vide) description d'un ticket.
 * Si l'écran d'édition refuse l'estimation, on réessaie sans elle.
 */
export async function updateIssue(
  userId: string,
  key: string,
  input: { summary: string; description?: string; estimateMinutes?: number },
): Promise<void> {
  const base: Record<string, unknown> = {
    summary: input.summary.slice(0, 250),
    ...(input.description ? { description: adf(input.description) } : {}),
  };
  const path = `/rest/api/3/issue/${encodeURIComponent(key)}?notifyUsers=false`;
  try {
    await jiraFetch(userId, path, {
      method: 'PUT',
      body: JSON.stringify({
        fields: {
          ...base,
          ...(input.estimateMinutes ? { timetracking: { originalEstimate: `${input.estimateMinutes}m` } } : {}),
        },
      }),
    });
  } catch (err) {
    if (!(err instanceof JiraApiError) || err.status !== 400 || !input.estimateMinutes) throw err;
    await jiraFetch(userId, path, { method: 'PUT', body: JSON.stringify({ fields: base }) });
  }
}

export type StatusCategory = 'new' | 'indeterminate' | 'done';

const CATEGORY_LABELS: Record<StatusCategory, string> = {
  new: 'À faire',
  indeterminate: 'En cours',
  done: 'Terminé',
};

/**
 * Amène le ticket dans un statut de la catégorie voulue (À faire / En cours / Terminé).
 * Ne fait rien s'il y est déjà ; lève si le workflow n'offre aucune transition adaptée.
 */
export async function transitionToCategory(
  userId: string,
  key: string,
  category: StatusCategory,
): Promise<boolean> {
  const issue = await getIssue(userId, key);
  if (issue.statusCategory === category) return false;
  const path = `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`;
  const data = await jiraFetch<{ transitions: any[] }>(userId, path);
  const target = data.transitions?.find((t) => t.to?.statusCategory?.key === category);
  if (!target) {
    throw new HttpError(
      400,
      `Jira : aucune transition vers « ${CATEGORY_LABELS[category]} » depuis « ${issue.status} ».`,
    );
  }
  await jiraFetch(userId, path, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: target.id } }),
  });
  return true;
}

/** Passe le ticket dans le premier statut de catégorie "done" disponible. */
export async function transitionToDone(userId: string, key: string): Promise<boolean> {
  return transitionToCategory(userId, key, 'done');
}
