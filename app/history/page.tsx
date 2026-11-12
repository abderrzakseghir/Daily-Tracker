'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components/layout';
import { Button, EmptyState, inputClass, PointsBadge, Skeleton } from '@/components/ui';
import { JiraChip } from '@/components/features';
import { cn } from '@/lib/utils';
import { addDaysISO, capitalize, daysBetween, fmt, fromISO, isoWeekday, monthRange, todayISO, weekRange } from '@/lib/dates';
import { formatDuration } from '@/lib/planner';
import { computeStreak, MOODS, summarizeDays, type DaySummary } from '@/lib/stats';
import { fetcher } from '@/lib/client/api';
import { useDayMetas, useMe, useRange } from '@/lib/client/data';
import { CATEGORY_COLORS, type Task } from '@/types';

export default function HistoryPage() {
  const { data: user } = useMe();
  const [month, setMonth] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => setMonth(todayISO().slice(0, 8) + '01'), []);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const range = month ? monthRange(month) : null;
  // La grille couvre des semaines complètes (lundi → dimanche)
  const gridFrom = range ? weekRange(range.from).from : null;
  const gridTo = range ? weekRange(range.to).to : null;
  const { data, isLoading } = useRange(gridFrom, gridTo);
  const today = month ? todayISO() : '';
  const { data: streakData } = useDayMetas(month ? addDaysISO(today, -365) : null, month ? today : null);
  const { data: results } = useSWR<Task[]>(debounced.length >= 2 ? `/api/search?q=${encodeURIComponent(debounced)}` : null, fetcher);

  if (!user || !month || !range || !gridFrom || !gridTo) {
    return (
      <AppLayout>
        <Skeleton className="h-[60vh]" />
      </AppLayout>
    );
  }

  const dates = daysBetween(gridFrom, gridTo);
  const summaries = summarizeDays(dates, data?.days ?? [], data?.tasks ?? []);
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const monthDays = summaries.filter((s) => s.date >= range.from && s.date <= range.to);
  const worked = monthDays.filter((s) => s.tasks > 0);
  const maxMinutes = Math.max(60, ...monthDays.map((s) => s.doneMinutes));
  const streak = streakData ? computeStreak(streakData.days, user.settings.workdays) : 0;
  const longest = streakData ? longestStreak(streakData.days.filter((d) => d.validated).map((d) => d.date), user.settings.workdays) : 0;

  const shiftMonth = (n: number) => {
    const d = fromISO(month);
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };

  return (
    <AppLayout>
      <PageHeader title="Historique" subtitle="Retrouvez et modifiez n'importe quelle journée passée" />

      {/* Recherche */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une tâche, une note, un ticket Jira…"
          className={cn(inputClass, 'h-11 pl-9')}
        />
      </div>

      {debounced.length >= 2 ? (
        <SearchResults results={results} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Jours travaillés" value={String(worked.length)} />
            <Mini label="Temps réalisé" value={formatDuration(monthDays.reduce((s, d) => s + d.doneMinutes, 0))} />
            <Mini label="Série actuelle" value={`🔥 ${streak} j`} />
            <Mini label="Meilleure série (1 an)" value={`🏆 ${longest} j`} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold">{capitalize(fmt(month, 'MMMM yyyy'))}</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase text-muted">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            {isLoading && !data ? (
              <Skeleton className="h-80" />
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {dates.map((date, i) => (
                  <DayCell
                    key={date}
                    index={i}
                    summary={byDate.get(date)!}
                    inMonth={date >= range.from && date <= range.to}
                    isToday={date === today}
                    isFuture={date > today}
                    isWorkday={user.settings.workdays.includes(isoWeekday(date))}
                    intensity={(byDate.get(date)?.doneMinutes ?? 0) / maxMinutes}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted">
              Moins
              {[0.15, 0.35, 0.6, 0.9].map((o) => (
                <span key={o} className="h-3 w-3 rounded" style={{ backgroundColor: `rgba(99,102,241,${o})` }} />
              ))}
              Plus
            </div>
          </div>

          {/* Liste des journées du mois */}
          <h3 className="mb-3 mt-8 text-sm font-semibold text-muted">Journées du mois</h3>
          {worked.length === 0 ? (
            <EmptyState icon="📭" title="Aucune activité ce mois-ci" />
          ) : (
            <div className="space-y-2">
              {[...worked].reverse().map((s) => (
                <DayRow key={s.date} summary={s} tasks={(data?.tasks ?? []).filter((t) => t.date === s.date)} />
              ))}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

function longestStreak(dates: string[], workdays: number[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of dates) {
    // départ d'une série : le jour ouvré précédent n'est pas validé
    let prev = addDaysISO(d, -1);
    while (!workdays.includes(isoWeekday(prev))) prev = addDaysISO(prev, -1);
    if (set.has(prev)) continue;
    let len = 0;
    let cur = d;
    while (set.has(cur)) {
      len++;
      cur = addDaysISO(cur, 1);
      while (!workdays.includes(isoWeekday(cur))) cur = addDaysISO(cur, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function DayCell({
  summary,
  inMonth,
  isToday,
  isFuture,
  isWorkday,
  intensity,
  index,
}: {
  summary: DaySummary;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  isWorkday: boolean;
  intensity: number;
  index: number;
}) {
  const mood = MOODS.find((m) => m.value === summary.mood);
  const has = summary.tasks > 0;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.008 }}>
      <Link
        href={isToday ? '/dashboard' : `/day/${summary.date}`}
        className={cn(
          'relative flex aspect-square flex-col justify-between rounded-xl border p-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft sm:p-2',
          inMonth ? 'border-border' : 'border-transparent opacity-35',
          !isWorkday && !has && 'bg-surface/50',
          isToday && 'ring-2 ring-accent',
        )}
        style={has ? { backgroundColor: `rgba(99,102,241,${0.08 + intensity * 0.6})` } : undefined}
        title={has ? `${summary.done}/${summary.tasks} tâches · ${formatDuration(summary.doneMinutes)}` : undefined}
      >
        <div className="flex items-start justify-between">
          <span className={cn('text-xs font-semibold sm:text-sm', intensity > 0.6 && 'text-white')}>{Number(summary.date.slice(8))}</span>
          {summary.validated && <span className="text-[10px] sm:text-xs">✅</span>}
        </div>
        <div className="flex items-end justify-between gap-1">
          {has && (
            <span className={cn('hidden text-[10px] font-medium tabular-nums sm:inline', intensity > 0.6 ? 'text-white' : 'text-muted')}>
              {formatDuration(summary.doneMinutes)}
            </span>
          )}
          {mood && <span className="text-xs sm:text-sm">{mood.emoji}</span>}
          {!has && !isFuture && isWorkday && inMonth && <span className="h-1 w-1 rounded-full bg-muted/40" />}
        </div>
      </Link>
    </motion.div>
  );
}

function DayRow({ summary, tasks }: { summary: DaySummary; tasks: Task[] }) {
  const mood = MOODS.find((m) => m.value === summary.mood);
  return (
    <Link href={`/day/${summary.date}`} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-accent/40 hover:shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium capitalize">{fmt(summary.date, 'EEEE d MMMM')}</p>
          <p className="text-xs text-muted">
            {summary.done}/{summary.tasks} tâches · {formatDuration(summary.doneMinutes)} · {summary.donePoints} pts
          </p>
        </div>
        <div className="flex items-center gap-2 text-lg">
          {mood?.emoji}
          {summary.validated ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Validée</span>
          ) : (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">À valider</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface">
        {tasks.map((t) => (
          <div
            key={t.id}
            className={cn('h-full', t.status !== 'done' && 'opacity-30')}
            style={{ width: `${(t.durationMinutes / Math.max(1, summary.minutes)) * 100}%`, backgroundColor: CATEGORY_COLORS[t.category] }}
            title={t.title}
          />
        ))}
      </div>
    </Link>
  );
}

function SearchResults({ results }: { results: Task[] | undefined }) {
  if (!results) return <Skeleton className="h-40" />;
  if (results.length === 0) return <EmptyState icon="🔍" title="Aucun résultat" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{results.length} résultat(s)</p>
      {results.map((t) => (
        <Link key={t.id} href={`/day/${t.date}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-accent/40">
          <span className="h-8 w-1 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[t.category] }} />
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-medium', t.status === 'done' && 'text-muted line-through')}>{t.title}</p>
            <p className="flex items-center gap-2 text-xs capitalize text-muted">
              {fmt(t.date, 'EEE d MMM yyyy')} · {formatDuration(t.durationMinutes)} <JiraChip task={t} />
            </p>
          </div>
          <PointsBadge points={t.points} />
        </Link>
      ))}
    </div>
  );
}
