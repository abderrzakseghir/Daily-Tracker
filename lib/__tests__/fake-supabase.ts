/**
 * Faux client Supabase en mémoire — couvre le sous-ensemble du query builder
 * utilisé par les routes API, pour les tester sans base de données.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;

const DEFAULTS: Record<string, () => Row> = {
  users: () => ({ id: randomUUID(), settings: {}, created_at: new Date().toISOString() }),
  days: () => ({ blockers: '', notes: '', mood: null, energy: null, validated: false, validated_at: null }),
  tasks: () => ({
    id: randomUUID(),
    description: '',
    category: 'development',
    points: 5,
    status: 'todo',
    position: 0,
    manual_duration: null,
    duration_minutes: 60,
    start_time: null,
    pinned: false,
    actual_minutes: 0,
    jira_key: null,
    jira_url: null,
    jira_project_key: null,
    jira_worklog_id: null,
    jira_synced_minutes: null,
    jira_synced_start: null,
    jira_synced_at: null,
    jira_sync_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  task_templates: () => ({ id: randomUUID(), weekdays: [], created_at: new Date().toISOString() }),
  jira_connections: () => ({}),
  push_subscriptions: () => ({}),
};

export const tables: Record<string, Row[]> = {};

export function resetDb() {
  for (const k of Object.keys(DEFAULTS)) tables[k] = [];
}
resetDb();

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private conflict: string[] = [];
  private head = false;
  private wantCount = false;
  private returning = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.returning = true;
    this.head = Boolean(opts?.head);
    this.wantCount = Boolean(opts?.count);
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = values;
    this.conflict = (opts?.onConflict ?? 'id').split(',');
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  gte(col: string, v: any) {
    this.filters.push((r) => r[col] >= v);
    return this;
  }
  lte(col: string, v: any) {
    this.filters.push((r) => r[col] <= v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  or(expr: string) {
    const parts = expr.split(',').map((p) => {
      const [col, , pattern] = p.split('.');
      const needle = pattern.replace(/%/g, '').trim().toLowerCase();
      return (r: Row) => String(r[col] ?? '').toLowerCase().includes(needle);
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  private exec(): { data: any; error: any; count?: number } {
    const rows = tables[this.table];
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];

    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      out = list.map((p) => ({ ...DEFAULTS[this.table](), ...p }));
      rows.push(...out);
    } else if (this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      for (const p of list) {
        const existing = rows.find((r) => this.conflict.every((c) => r[c] === p[c]));
        if (existing) Object.assign(existing, p);
        else rows.push({ ...DEFAULTS[this.table](), ...p });
      }
    } else if (this.op === 'update') {
      out = rows.filter(match);
      out.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      tables[this.table] = rows.filter((r) => !match(r));
      if (this.table === 'users') {
        for (const t of ['tasks', 'days', 'task_templates', 'jira_connections']) {
          tables[t] = tables[t].filter((r) => tables.users.some((u) => u.id === r.user_id));
        }
      }
    } else {
      out = rows.filter(match);
      for (const o of [...this.orders].reverse()) {
        out.sort((a, b) => (a[o.col] < b[o.col] ? -1 : a[o.col] > b[o.col] ? 1 : 0) * (o.asc ? 1 : -1));
      }
      if (this.max != null) out = out.slice(0, this.max);
    }

    const copy = out.map((r) => ({ ...r }));
    if (this.wantCount && this.head) return { data: null, error: null, count: copy.length };
    if (this.mode === 'single') {
      return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { message: 'not single' } };
    }
    if (this.mode === 'maybe') return { data: copy[0] ?? null, error: null };
    return { data: this.op === 'select' || this.returning ? copy : null, error: null };
  }

  then<T>(resolve: (v: any) => T, reject?: (e: unknown) => T) {
    try {
      return Promise.resolve(resolve(this.exec()));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }
}

export const fakeDb = { from: (table: string) => new Query(table) };
