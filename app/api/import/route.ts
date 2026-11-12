import { HttpError, ok, withUser } from '@/lib/server/http';
import { getSettings, replanDay, upsertDayMeta } from '@/lib/server/repo';
import { db } from '@/lib/server/supabase';
import { CATEGORIES } from '@/types';

export const dynamic = 'force-dynamic';

/** Ancien format (v1, localStorage) */
interface LegacyEntry {
  date: string;
  blockers?: string;
  validated?: boolean;
  validatedAt?: string;
  tasks?: { description: string; category: string; duration: string; customDuration?: number; completed?: boolean }[];
  plannedTasks?: { description: string; category: string; estimatedDuration?: string; estimatedCustomDuration?: number }[];
}

const LEGACY_MINUTES: Record<string, number> = {
  '15min': 15,
  '30min': 30,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  '4h': 240,
};

const category = (c: string) => ((CATEGORIES as readonly string[]).includes(c) ? c : 'other');

/**
 * POST /api/import { entries: LegacyEntry[] }
 * Importe les données de l'ancienne version (stockées dans le navigateur).
 * Les journées qui contiennent déjà des tâches sont ignorées (import idempotent).
 */
export const POST = withUser(async (req, { userId }) => {
  const { entries } = (await req.json()) as { entries: LegacyEntry[] };
  if (!Array.isArray(entries)) throw new HttpError(400, 'Format invalide');

  const { data: existing } = await db().from('tasks').select('date').eq('user_id', userId);
  const taken = new Set((existing ?? []).map((r) => r.date));
  const settings = await getSettings(userId);
  let importedDays = 0;
  let importedTasks = 0;

  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || taken.has(e.date)) continue;
    const rows = [
      ...(e.tasks ?? []).map((t) => ({
        title: t.description,
        category: category(t.category),
        manual_duration: t.duration === 'custom' ? t.customDuration || 30 : LEGACY_MINUTES[t.duration] ?? 30,
        status: t.completed === false ? 'todo' : 'done',
      })),
      ...(e.plannedTasks ?? []).map((t) => ({
        title: t.description,
        category: category(t.category),
        manual_duration:
          t.estimatedDuration === 'custom'
            ? t.estimatedCustomDuration || null
            : LEGACY_MINUTES[t.estimatedDuration ?? ''] ?? null,
        status: 'todo',
      })),
    ].filter((r) => r.title?.trim());

    if (rows.length > 0) {
      const { error } = await db()
        .from('tasks')
        .insert(rows.map((r, i) => ({ ...r, user_id: userId, date: e.date, points: 5, position: i })));
      if (error) throw error;
      importedTasks += rows.length;
    }
    if (rows.length > 0 || e.blockers || e.validated) {
      await upsertDayMeta(userId, e.date, {
        blockers: e.blockers ?? '',
        validated: Boolean(e.validated),
        validated_at: e.validated ? e.validatedAt ?? new Date().toISOString() : null,
      });
      await replanDay(userId, e.date, { ...settings, autoSyncWorklog: false });
      importedDays++;
    }
  }

  return ok({ importedDays, importedTasks });
});
