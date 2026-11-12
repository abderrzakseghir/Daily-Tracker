'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  ArrowRightToLine,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Flame,
  ListChecks,
  RefreshCw,
  Repeat,
  RotateCcw,
} from 'lucide-react';
import { Button, EmptyState, Segmented, Skeleton } from '@/components/ui';
import { CalendarGrid } from './calendar-grid';
import { DayJournal } from './day-journal';
import { JiraExportModal } from './jira-export-modal';
import { JiraImportModal } from './jira-import-modal';
import { JiraLogo, jiraSyncState } from './jira-chip';
import { QuickAdd } from './quick-add';
import { TaskEditor, type TaskDraft } from './task-editor';
import { TaskItem } from './task-item';
import { cn } from '@/lib/utils';
import { addDaysISO, isoWeekday, nextWorkday, relativeDayLabel, todayISO, fmt } from '@/lib/dates';
import { dayCapacity, formatDuration } from '@/lib/planner';
import { computeStreak } from '@/lib/stats';
import {
  applyTemplates,
  carryOver,
  reorderTasks,
  syncDay,
  updateDayMeta,
  updateTask,
  useDay,
  useMe,
  useDayMetas,
  useTemplates,
} from '@/lib/client/data';
import { toast, useUi } from '@/lib/store';
import type { Task, User } from '@/types';

export function DayView({ date }: { date: string }) {
  const { data: user } = useMe();
  if (!user) return <DaySkeleton />;
  return <DayContent date={date} user={user} />;
}

function DayContent({ date, user }: { date: string; user: User }) {
  const router = useRouter();
  const { day, isLoading } = useDay(date);
  const settings = user.settings;
  const today = todayISO();
  const isToday = date === today;
  const isPast = date < today;
  const [editing, setEditing] = React.useState<Task | TaskDraft | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<'list' | 'agenda'>('list');
  const startFocus = useUi((s) => s.startFocus);
  const focus = useUi((s) => s.focus);

  // Ordre local pendant le glisser (persisté au relâchement)
  const [order, setOrder] = React.useState<Task[]>([]);
  React.useEffect(() => {
    if (day) setOrder([...day.tasks].sort((a, b) => a.position - b.position));
  }, [day]);

  // Série de jours validés (90 derniers jours)
  const { data: recent } = useDayMetas(addDaysISO(today, -120), today);
  const streak = recent ? computeStreak(recent.days, settings.workdays) : 0;

  const goto = (d: string) => router.push(d === today ? '/dashboard' : `/day/${d}`);

  // Raccourcis clavier : ← → pour changer de jour, T pour aujourd'hui
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') goto(addDaysISO(date, -1));
      if (e.key === 'ArrowRight') goto(addDaysISO(date, 1));
      if (e.key === 't') goto(today);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (isLoading || !day) return <DaySkeleton />;

  const tasks = day.tasks;
  const meta = day.meta;
  const done = tasks.filter((t) => t.status === 'done');
  const totalPoints = tasks.reduce((s, t) => s + t.points, 0);
  const donePoints = done.reduce((s, t) => s + t.points, 0);
  const planned = tasks.reduce((s, t) => s + t.durationMinutes, 0);
  const capacity = dayCapacity(settings);
  const focusMinutes = tasks.reduce((s, t) => s + t.actualMinutes, 0);
  const pendingJira = tasks.filter((t) => ['pending', 'error'].includes(jiraSyncState(t))).length;
  const notOnJira = tasks.filter((t) => !t.jiraKey).length;
  const unfinished = tasks.length - done.length;
  const progress = totalPoints > 0 ? donePoints / totalPoints : 0;

  const toggle = (t: Task) =>
    updateTask(t, { status: t.status === 'done' ? 'todo' : 'done' }, settings);

  const onFocus = (t: Task) => {
    startFocus({ taskId: t.id, taskTitle: t.title, date: t.date, targetMinutes: settings.focusMinutes });
    if (t.status === 'todo') updateTask(t, { status: 'in_progress' }, settings);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  };

  const persistOrder = () => {
    const ids = order.map((t) => t.id);
    if (ids.join() !== tasks.map((t) => t.id).join()) reorderTasks(date, ids, settings);
  };

  const validate = async () => {
    const res = await updateDayMeta(date, { validated: !meta.validated });
    if (res && !meta.validated) toast(`Journée validée 🎉 ${streak + 1 > 1 ? `Série : ${streak + 1} jours` : ''}`, 'success');
  };

  const target = nextWorkday(date, settings.workdays);

  return (
    <div className="space-y-5">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => goto(addDaysISO(date, -1))} aria-label="Jour précédent">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <motion.h1 key={date} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold tracking-tight lg:text-3xl">
              {relativeDayLabel(date)}
            </motion.h1>
            <p className="text-sm capitalize text-muted">{fmt(date, 'EEEE d MMMM yyyy')}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => goto(addDaysISO(date, 1))} aria-label="Jour suivant">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => goto(today)}>
              Aujourd&apos;hui
            </Button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && goto(e.target.value)}
            className="h-9 rounded-xl border border-border bg-card px-2 text-sm"
            aria-label="Choisir une date"
          />
          {streak > 0 && (
            <span className="inline-flex h-9 items-center gap-1 rounded-xl bg-orange-500/10 px-3 text-sm font-semibold text-orange-500" title="Jours ouvrés validés d'affilée">
              <Flame className="h-4 w-4" /> {streak}
            </span>
          )}
        </div>
      </div>

      {isPast && !meta.validated && tasks.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-dark dark:text-warning">
          <RotateCcw className="h-4 w-4" /> Journée passée non validée — vous pouvez encore la modifier puis la valider.
        </div>
      )}

      {/* ── Statistiques ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Progression" value={`${Math.round(progress * 100)}%`} sub={`${donePoints}/${totalPoints} points`}>
          <ProgressRing value={progress} />
        </StatCard>
        <StatCard
          label="Planifié"
          value={formatDuration(planned)}
          sub={`sur ${formatDuration(capacity)}`}
          tone={planned > capacity ? 'error' : undefined}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <motion.div
              className={cn('h-full rounded-full', planned > capacity ? 'bg-error' : 'bg-accent')}
              initial={false}
              animate={{ width: `${Math.min(100, (planned / Math.max(1, capacity)) * 100)}%` }}
            />
          </div>
        </StatCard>
        <StatCard label="Tâches" value={`${done.length}/${tasks.length}`} sub={unfinished > 0 ? `${unfinished} restante(s)` : tasks.length ? 'Tout est fait ✨' : '—'} />
        <StatCard label="Focus" value={formatDuration(focusMinutes)} sub="temps mesuré" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Colonne principale ── */}
        <div className="min-w-0 space-y-4">
          <QuickAdd date={date} user={user} onOpenAdvanced={() => setEditing({ date })} />

          <TemplateSuggestions date={date} tasks={tasks} />

          <div className="flex items-center justify-between lg:hidden">
            <Segmented
              size="sm"
              value={mobileTab}
              onChange={setMobileTab}
              options={[
                { value: 'list', label: 'Liste' },
                { value: 'agenda', label: 'Agenda' },
              ]}
            />
          </div>

          <div className={cn(mobileTab === 'agenda' && 'max-lg:hidden')}>
            {tasks.length === 0 ? (
              <EmptyState
                icon="🗒️"
                title="Aucune tâche pour cette journée"
                description="Ajoutez vos tâches avec des points de 1 à 10 : le temps de chacune est calculé automatiquement."
                action={
                  user.jira.connected ? (
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                      <JiraLogo className="h-4 w-4 text-[#0052CC]" /> Importer mes tickets Jira
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
                <AnimatePresence initial={false}>
                  {order.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      onToggle={toggle}
                      onOpen={setEditing}
                      onFocus={onFocus}
                      onDragEnd={persistOrder}
                      focused={focus?.taskId === t.id}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}
          </div>

          <div className={cn('lg:hidden', mobileTab === 'list' && 'hidden')}>
            <CalendarGrid
              dates={[date]}
              tasks={tasks}
              settings={settings}
              showHeader={false}
              hourHeight={56}
              onSelect={setEditing}
              onMove={(t, d, start) => updateTask(t, { date: d, startTime: start, pinned: true }, settings)}
              onResize={(t, minutes) => updateTask(t, { manualDuration: minutes }, settings)}
              onCreateAt={(d, start) => setEditing({ date: d, startTime: start })}
            />
          </div>

          {/* Actions de journée */}
          <div className="flex flex-wrap gap-2">
            {user.jira.connected && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <JiraLogo className="h-3.5 w-3.5 text-[#0052CC] dark:text-[#4C9AFF]" /> Importer de Jira
              </Button>
            )}
            {user.jira.connected && tasks.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                <JiraLogo className="h-3.5 w-3.5 text-[#0052CC] dark:text-[#4C9AFF]" /> Exporter vers Jira
                {notOnJira > 0 && (
                  <span className="rounded-md bg-[#0052CC]/10 px-1.5 text-[11px] font-semibold tabular-nums text-[#0052CC] dark:bg-[#4C9AFF]/15 dark:text-[#4C9AFF]">
                    {notOnJira}
                  </span>
                )}
              </Button>
            )}
            {user.jira.connected && pendingJira > 0 && (
              <Button variant="outline" size="sm" onClick={() => syncDay(date)}>
                <RefreshCw className="h-3.5 w-3.5" /> Synchroniser Jira ({pendingJira})
              </Button>
            )}
            {unfinished > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const res = await carryOver(date, target);
                  if (res) toast(`${res.moved} tâche(s) reportée(s) à ${relativeDayLabel(target).toLowerCase()}`, 'success', { label: 'Voir', onClick: () => goto(target) });
                }}
              >
                <ArrowRightToLine className="h-3.5 w-3.5" /> Reporter les non terminées
              </Button>
            )}
            <Link href="/planning" className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Voir la semaine
            </Link>
          </div>
        </div>

        {/* ── Colonne latérale ── */}
        <div className="space-y-4">
          <div className="hidden lg:block">
            <CalendarGrid
              dates={[date]}
              tasks={tasks}
              settings={settings}
              showHeader={false}
              hourHeight={44}
              onSelect={setEditing}
              onMove={(t, d, start) => updateTask(t, { date: d, startTime: start, pinned: true }, settings)}
              onResize={(t, minutes) => updateTask(t, { manualDuration: minutes }, settings)}
              onCreateAt={(d, start) => setEditing({ date: d, startTime: start })}
            />
          </div>

          <DayJournal meta={meta} />

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              variant={meta.validated ? 'outline' : 'success'}
              className="w-full"
              onClick={validate}
              disabled={tasks.length === 0 && !meta.validated}
            >
              <CalendarCheck2 className="h-5 w-5" />
              {meta.validated ? 'Journée validée — rouvrir' : 'Valider la journée'}
            </Button>
          </motion.div>
          {user.jira.connected && !meta.validated && (
            <p className="text-center text-xs text-muted">La validation envoie tous les worklogs Jira en attente.</p>
          )}
        </div>
      </div>

      <TaskEditor task={editing} user={user} onClose={() => setEditing(null)} />
      {user.jira.connected && (
        <JiraImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          date={date}
          existingKeys={new Set(tasks.map((t) => t.jiraKey).filter(Boolean) as string[])}
        />
      )}
      {user.jira.connected && (
        <JiraExportModal
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          date={date}
          tasks={tasks}
          defaultProject={settings.defaultJiraProject}
        />
      )}
    </div>
  );
}

function TemplateSuggestions({ date, tasks }: { date: string; tasks: Task[] }) {
  const { data: templates } = useTemplates();
  const [hidden, setHidden] = React.useState(false);
  const titles = new Set(tasks.map((t) => t.title.toLowerCase()));
  const weekday = isoWeekday(date);
  const suggested = (templates ?? []).filter((t) => t.weekdays.includes(weekday) && !titles.has(t.title.toLowerCase()));
  if (hidden || suggested.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
      <Repeat className="h-4 w-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Tâches récurrentes :</span>{' '}
        <span className="text-muted">{suggested.map((t) => t.title).join(', ')}</span>
      </p>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>Ignorer</Button>
        <Button size="sm" onClick={() => applyTemplates(date, suggested.map((t) => t.id))}>Ajouter</Button>
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'error';
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums tracking-tight', tone === 'error' && 'text-error')}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {children}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="absolute right-3 top-3 h-10 w-10 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface)" strokeWidth="5" />
      <motion.circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={value >= 1 ? '#10B981' : '#6366F1'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      />
    </svg>
  );
}

function DaySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <Skeleton className="h-14" />
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
