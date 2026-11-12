'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, Circle, Clipboard, Maximize2, Minimize2, Play, RotateCcw, Timer } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components/layout';
import { Button, Skeleton } from '@/components/ui';
import { JiraChip } from '@/components/features';
import { cn } from '@/lib/utils';
import { nextWorkday, relativeDayLabel, todayISO } from '@/lib/dates';
import { formatDuration } from '@/lib/planner';
import { useMe, useRange, emptyMeta } from '@/lib/client/data';
import { toast } from '@/lib/store';
import { CATEGORY_COLORS, type Task } from '@/types';

export default function DailyMeetingPage() {
  const { data: user } = useMe();
  const [today, setToday] = React.useState<string | null>(null);
  const [presenting, setPresenting] = React.useState(false);
  React.useEffect(() => setToday(todayISO()), []);

  const previous = today && user ? nextWorkday(today, user.settings.workdays, -1) : null;
  const { data } = useRange(previous, today);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPresenting(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user || !today || !previous || !data) {
    return (
      <AppLayout>
        <Skeleton className="h-[60vh]" />
      </AppLayout>
    );
  }

  const yesterdayTasks = data.tasks.filter((t) => t.date === previous);
  const todayTasks = data.tasks.filter((t) => t.date === today);
  const done = yesterdayTasks.filter((t) => t.status === 'done');
  const notDone = yesterdayTasks.filter((t) => t.status !== 'done');
  const todayMeta = data.days.find((d) => d.date === today) ?? emptyMeta(today);
  const prevMeta = data.days.find((d) => d.date === previous) ?? emptyMeta(previous);
  const blockers = todayMeta.blockers.trim() || prevMeta.blockers.trim();
  const prevLabel = relativeDayLabel(previous);

  const copy = async () => {
    const line = (t: Task) => `• ${t.title}${t.jiraKey && !t.title.includes(t.jiraKey) ? ` (${t.jiraKey})` : ''}`;
    const text = [
      `*${prevLabel}*`,
      ...(done.length ? done.map(line) : ['• —']),
      ...(notDone.length ? ['_En cours / reporté :_', ...notDone.map(line)] : []),
      '',
      "*Aujourd'hui*",
      ...(todayTasks.length ? todayTasks.map(line) : ['• —']),
      '',
      '*Bloquants*',
      blockers ? blockers.split('\n').map((b) => `• ${b.replace(/^[-•]\s*/, '')}`).join('\n') : '• Aucun 👍',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Résumé copié — collez-le dans Slack ou Teams', 'success');
    } catch {
      toast('Copie impossible dans ce navigateur', 'error');
    }
  };

  const content = (
    <div className={cn('grid gap-4', presenting ? 'lg:grid-cols-3' : 'md:grid-cols-3')}>
      <Column title={prevLabel} subtitle={`${done.length} terminée(s) · ${formatDuration(done.reduce((s, t) => s + t.durationMinutes, 0))}`} accent="#1baf7a" big={presenting} index={0}>
        {done.map((t) => <Row key={t.id} task={t} big={presenting} done />)}
        {notDone.length > 0 && <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted">En cours / reporté</p>}
        {notDone.map((t) => <Row key={t.id} task={t} big={presenting} />)}
        {yesterdayTasks.length === 0 && <Empty big={presenting}>Rien de noté</Empty>}
      </Column>
      <Column title="Aujourd'hui" subtitle={`${todayTasks.length} tâche(s) · ${formatDuration(todayTasks.reduce((s, t) => s + t.durationMinutes, 0))}`} accent="#2a78d6" big={presenting} index={1}>
        {todayTasks.map((t) => <Row key={t.id} task={t} big={presenting} done={t.status === 'done'} />)}
        {todayTasks.length === 0 && <Empty big={presenting}>Pas encore planifié</Empty>}
      </Column>
      <Column title="Bloquants" subtitle={blockers ? 'À discuter' : 'Aucun'} accent="#e34948" big={presenting} index={2}>
        {blockers ? (
          blockers.split('\n').filter(Boolean).map((b, i) => (
            <div key={i} className={cn('flex gap-2', presenting ? 'text-lg' : 'text-sm')}>
              <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <span>{b.replace(/^[-•]\s*/, '')}</span>
            </div>
          ))
        ) : (
          <Empty big={presenting}>Aucun bloquant 👍</Empty>
        )}
      </Column>
    </div>
  );

  if (presenting) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-6 lg:p-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted">Daily meeting</p>
              <h1 className="text-3xl font-bold lg:text-4xl">{user.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <SpeakTimer />
              <Button variant="outline" onClick={() => setPresenting(false)}>
                <Minimize2 className="h-4 w-4" /> Quitter
              </Button>
            </div>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Daily meeting"
        subtitle="Votre point quotidien, prêt à présenter"
        actions={
          <>
            <SpeakTimer />
            <Button variant="outline" size="sm" onClick={copy}>
              <Clipboard className="h-4 w-4" /> Copier
            </Button>
            <Button size="sm" onClick={() => setPresenting(true)}>
              <Maximize2 className="h-4 w-4" /> Présenter
            </Button>
          </>
        }
      />
      {content}
    </AppLayout>
  );
}

function Column({
  title,
  subtitle,
  accent,
  big,
  index,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  big: boolean;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="h-1" style={{ backgroundColor: accent }} />
      <div className={cn(big ? 'p-6' : 'p-4')}>
        <h2 className={cn('font-bold', big ? 'text-2xl' : 'text-lg')}>{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
        <div className={cn('mt-4', big ? 'space-y-3' : 'space-y-2')}>{children}</div>
      </div>
    </motion.section>
  );
}

function Row({ task, big, done }: { task: Task; big: boolean; done?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? <CheckCircle2 className={cn('mt-0.5 shrink-0 text-success', big ? 'h-5 w-5' : 'h-4 w-4')} /> : <Circle className={cn('mt-0.5 shrink-0 text-muted', big ? 'h-5 w-5' : 'h-4 w-4')} />}
      <div className="min-w-0 flex-1">
        <p className={cn(big ? 'text-lg' : 'text-sm')}>{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[task.category] }} />
          {formatDuration(task.durationMinutes)} · {task.points} pts
          <JiraChip task={task} />
        </div>
      </div>
    </div>
  );
}

function Empty({ children, big }: { children: React.ReactNode; big: boolean }) {
  return <p className={cn('text-muted', big ? 'text-lg' : 'text-sm')}>{children}</p>;
}

/** Chrono de prise de parole (2 min par défaut). */
function SpeakTimer() {
  const LIMIT = 120;
  const [running, setRunning] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const over = seconds > LIMIT;
  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <div className={cn('flex h-9 items-center gap-1 rounded-xl border px-2 text-sm font-semibold tabular-nums', over ? 'border-error/40 bg-error/10 text-error' : 'border-border bg-card')}>
      <Timer className="h-4 w-4" />
      <span className="w-10 text-center">{mm}</span>
      <button onClick={() => setRunning((r) => !r)} className="rounded-lg p-1 hover:bg-surface" aria-label={running ? 'Pause' : 'Démarrer le chrono'}>
        {running ? <span className="block h-3 w-3 rounded-sm bg-current" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button onClick={() => { setRunning(false); setSeconds(0); }} className="rounded-lg p-1 hover:bg-surface" aria-label="Réinitialiser">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
