import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fakeDb, resetDb, tables } from './fake-supabase';

vi.mock('@/lib/server/supabase', () => ({ db: () => fakeDb }));

process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-42';

const { signSession } = await import('@/lib/server/session');
const tasksRoute = await import('@/app/api/tasks/route');
const taskRoute = await import('@/app/api/tasks/[id]/route');
const dayRoute = await import('@/app/api/days/[date]/route');
const carryRoute = await import('@/app/api/days/[date]/carry-over/route');
const meRoute = await import('@/app/api/me/route');
const exportRoute = await import('@/app/api/jira/export/route');

const USER = '11111111-1111-1111-1111-111111111111';
const DATE = '2026-11-10';
let cookie = '';

function req(method: string, url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function call(handler: any, method: string, url: string, body?: unknown, params: Record<string, string> = {}) {
  const res: Response = await handler(req(method, url, body), { params });
  return { status: res.status, json: await res.json() };
}

/** Faux Jira : enregistre les appels et répond comme l'API Cloud. */
const jiraCalls: { method: string; url: string; body: any }[] = [];
function mockJira() {
  let worklogSeq = 0;
  let issueSeq = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    jiraCalls.push({ method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (url.includes('/issuetypes')) return json({ issueTypes: [{ id: '10001', name: 'Task', subtask: false }] });
    if (url.endsWith('/rest/api/3/issue') && method === 'POST') return json({ key: `DT-${++issueSeq}` }, 201);
    if (url.includes('/worklog') && method === 'POST') return json({ id: String(++worklogSeq) }, 201);
    if (url.includes('/worklog/') && method === 'PUT') return json({ id: url.split('/worklog/')[1].split('?')[0] });
    if (url.includes('/worklog/') && method === 'DELETE') return new Response(null, { status: 204 });
    return json({ errorMessages: ['not mocked'] }, 404);
  }));
}

const dayTasks = () => tables.tasks.filter((t) => t.date === DATE).sort((a, b) => a.position - b.position);

beforeEach(async () => {
  resetDb();
  jiraCalls.length = 0;
  tables.users.push({
    id: USER,
    google_id: 'g',
    email: 'a@b.c',
    name: 'Test',
    settings: { workdayStart: '09:00', workdayEnd: '17:30', lunchEnabled: true, lunchStart: '12:00', lunchEnd: '13:00', timezone: 'Europe/Paris' },
    created_at: new Date().toISOString(),
  });
  cookie = `dt_session=${await signSession(USER)}`;
  mockJira();
});

describe('API tâches', () => {
  it('refuse sans session', async () => {
    cookie = '';
    const r = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'X' });
    expect(r.status).toBe(401);
    expect(r.json.success).toBe(false);
  });

  it('crée des tâches et répartit la journée selon les points', async () => {
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Feature', points: 6 });
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Review', points: 3 });
    const r = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Mails', points: 1 });

    expect(r.json.success).toBe(true);
    const tasks = r.json.data.days[0].tasks;
    expect(tasks.map((t: any) => [t.title, t.startTime, t.durationMinutes])).toEqual([
      ['Feature', '09:00', 270],
      ['Review', '14:30', 135], // 09:00 + 4h30 en sautant la pause 12h–13h
      ['Mails', '16:45', 45],
    ]);
  });

  it('épingle une tâche déplacée et ré-enchaîne les autres', async () => {
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'A', manualDuration: 60 });
    const b = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'B', manualDuration: 30 });
    const idB = b.json.data.taskId;
    const r = await call(taskRoute.PATCH, 'PATCH', `/api/tasks/${idB}`, { startTime: '09:00', pinned: true }, { id: idB });
    const byTitle = Object.fromEntries(r.json.data.days[0].tasks.map((t: any) => [t.title, t.startTime]));
    expect(byTitle).toEqual({ B: '09:00', A: '09:30' });
  });

  it('déplace une tâche vers un autre jour et re-planifie les deux', async () => {
    const a = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'A', points: 5 });
    const r = await call(taskRoute.PATCH, 'PATCH', `/api/tasks/x`, { date: '2026-11-11' }, { id: a.json.data.taskId });
    expect(r.json.data.days).toHaveLength(2);
    expect(r.json.data.days[1].tasks[0].date).toBe('2026-11-11');
    expect(dayTasks()).toHaveLength(0);
  });

  it('valide les entrées', async () => {
    const r = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'A', points: 42 });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/1 à 10/);
  });

  it("reporte les tâches non terminées et les journées s'enregistrent", async () => {
    const a = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Fait' });
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Pas fait' });
    await call(taskRoute.PATCH, 'PATCH', '/x', { status: 'done' }, { id: a.json.data.taskId });

    const r = await call(carryRoute.POST, 'POST', '/x', { to: '2026-11-11' }, { date: DATE });
    expect(r.json.data.moved).toBe(1);
    expect(r.json.data.to.tasks.map((t: any) => t.title)).toEqual(['Pas fait']);

    const d = await call(dayRoute.PATCH, 'PATCH', '/x', { mood: 4, blockers: 'Attente API' }, { date: DATE });
    expect(d.json.data.meta).toMatchObject({ mood: 4, blockers: 'Attente API', validated: false });
    const v = await call(dayRoute.PATCH, 'PATCH', '/x', { validated: true }, { date: DATE });
    expect(v.json.data.meta.validated).toBe(true);
    expect(v.json.data.meta.mood).toBe(4);
  });

  it('refuse des paramètres incohérents', async () => {
    const r = await call(meRoute.PATCH, 'PATCH', '/api/me', { settings: { workdayStart: '18:00', workdayEnd: '09:00' } });
    expect(r.status).toBe(400);
  });
});

describe('Synchronisation Jira', () => {
  beforeEach(() => {
    tables.jira_connections.push({
      user_id: USER,
      account_id: 'acc-1',
      display_name: 'Test',
      cloud_id: 'cloud',
      cloud_url: 'https://test.atlassian.net',
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
  });

  it('crée le ticket, logge le temps à la fin et le tient à jour', async () => {
    const created = await call(tasksRoute.POST, 'POST', '/api/tasks', {
      date: DATE,
      title: 'Nouvelle API',
      points: 5,
      createInJiraProject: 'DT',
    });
    const task = created.json.data.days[0].tasks[0];
    expect(task.jiraKey).toBe('DT-1');
    expect(task.jiraUrl).toBe('https://test.atlassian.net/browse/DT-1');
    const issue = jiraCalls.find((c) => c.url.endsWith('/rest/api/3/issue'))!;
    expect(issue.body.fields).toMatchObject({ project: { key: 'DT' }, summary: 'Nouvelle API', assignee: { accountId: 'acc-1' } });

    // Terminée → worklog créé, daté dans le fuseau de l'utilisateur
    await call(taskRoute.PATCH, 'PATCH', '/x', { status: 'done' }, { id: task.id });
    const post = jiraCalls.find((c) => c.method === 'POST' && c.url.includes('/worklog'))!;
    expect(post.body.started).toBe('2026-11-10T09:00:00.000+0100');
    expect(post.body.timeSpentSeconds).toBe(450 * 60); // seule tâche : toute la journée

    // Une nouvelle tâche réduit sa part → le worklog est mis à jour (PUT)
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Autre', points: 5 });
    const put = jiraCalls.find((c) => c.method === 'PUT' && c.url.includes('/worklog/1'))!;
    expect(put.body.timeSpentSeconds).toBe(225 * 60);
    expect(dayTasks()[0]).toMatchObject({ jira_worklog_id: '1', jira_synced_minutes: 225, jira_sync_error: null });

    // Rouverte → worklog supprimé
    await call(taskRoute.PATCH, 'PATCH', '/x', { status: 'todo' }, { id: task.id });
    expect(jiraCalls.some((c) => c.method === 'DELETE' && c.url.includes('/worklog/1'))).toBe(true);
    expect(dayTasks()[0].jira_worklog_id).toBeNull();
  });

  it('exporte la journée vers Jira puis ne crée que les nouvelles tâches', async () => {
    const a = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'API', points: 5 });
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Front', points: 5 });
    await call(taskRoute.PATCH, 'PATCH', '/x', { status: 'done' }, { id: a.json.data.taskId });

    const r = await call(exportRoute.POST, 'POST', '/api/jira/export', { date: DATE, projectKey: 'DT' });
    expect(r.json.data).toMatchObject({ created: 2, linked: 2 });
    const creations = jiraCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/rest/api/3/issue'));
    expect(creations.map((c) => c.body.fields.timetracking)).toEqual([
      { originalEstimate: '225m' },
      { originalEstimate: '225m' },
    ]);
    expect(jiraCalls.filter((c) => c.url.includes('/issuetypes'))).toHaveLength(1);
    expect(dayTasks().every((t) => t.jira_key)).toBe(true);
    // Seule la tâche terminée reçoit un worklog, à son horaire planifié
    const worklogs = jiraCalls.filter((c) => c.method === 'POST' && c.url.includes('/worklog'));
    expect(worklogs).toHaveLength(1);
    expect(worklogs[0].body).toMatchObject({ started: '2026-11-10T09:00:00.000+0100', timeSpentSeconds: 225 * 60 });

    // Nouvelle tâche ajoutée ensuite → un seul ticket de plus
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'Doc', points: 2 });
    jiraCalls.length = 0;
    const again = await call(exportRoute.POST, 'POST', '/api/jira/export', { date: DATE, projectKey: 'DT' });
    expect(again.json.data).toMatchObject({ created: 1, linked: 3 });
    const second = jiraCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/rest/api/3/issue'));
    expect(second.map((c) => c.body.fields.summary)).toEqual(['Doc']);
    expect(new Set(dayTasks().map((t) => t.jira_key)).size).toBe(3);
  });

  it("refuse l'export sans projet quand des tickets sont à créer", async () => {
    await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'A' });
    const r = await call(exportRoute.POST, 'POST', '/api/jira/export', { date: DATE, projectKey: '' });
    expect(r.status).toBe(400);
    expect(jiraCalls.some((c) => c.url.endsWith('/rest/api/3/issue'))).toBe(false);
  });

  it("enregistre l'erreur Jira sans bloquer la tâche", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errorMessages: ['Projet inconnu'] }), { status: 400 })));
    const r = await call(tasksRoute.POST, 'POST', '/api/tasks', { date: DATE, title: 'X', createInJiraProject: 'NOPE' });
    expect(r.json.success).toBe(true);
    expect(r.json.data.warning).toContain('Projet inconnu');
    expect(dayTasks()).toHaveLength(1);
  });
});
