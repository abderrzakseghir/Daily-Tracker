'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pause, Play, Square, Timer } from 'lucide-react';
import { focusElapsedMs, toast, useUi } from '@/lib/store';
import { logFocus } from '@/lib/client/data';
import { cn } from '@/lib/utils';

function mmss(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Minuteur focus flottant (type Pomodoro) — le temps mesuré est ajouté à la tâche. */
export function FocusTimer() {
  const { focus, pauseFocus, resumeFocus, stopFocus } = useUi();
  const [, tick] = React.useState(0);
  const notified = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!focus || focus.paused) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [focus]);

  const elapsed = focus ? focusElapsedMs(focus) : 0;
  const target = (focus?.targetMinutes ?? 25) * 60_000;
  const progress = Math.min(1, elapsed / target);
  const reached = elapsed >= target;

  React.useEffect(() => {
    if (!focus || !reached || notified.current === `${focus.taskId}-${focus.startedAt}`) return;
    notified.current = `${focus.taskId}-${focus.startedAt}`;
    toast(`Session focus terminée : ${focus.taskTitle}. Faites une pause ☕`, 'success');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Session focus terminée', { body: focus.taskTitle, icon: '/icon-192.svg' });
    }
  }, [focus, reached]);

  const finish = (markDone: boolean) => {
    const result = stopFocus();
    if (result) logFocus(result.session.taskId, result.minutes, markDone);
  };

  const r = 18;
  const circumference = 2 * Math.PI * r;

  return (
    <AnimatePresence>
      {focus && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card py-2 pl-2 pr-3 shadow-card lg:bottom-6 lg:right-6"
        >
          <div className="relative h-11 w-11">
            <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface)" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r={r}
                fill="none"
                stroke={reached ? '#10B981' : '#6366F1'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <Timer className={cn('absolute inset-0 m-auto h-4 w-4', reached ? 'text-success' : 'text-accent')} />
          </div>
          <div className="min-w-0 max-w-[150px] sm:max-w-[220px]">
            <p className="truncate text-xs text-muted">{focus.taskTitle}</p>
            <p className={cn('font-mono text-lg font-semibold tabular-nums leading-tight', focus.paused && 'text-muted')}>
              {mmss(elapsed)}
              <span className="ml-1 text-xs font-normal text-muted">/ {focus.targetMinutes} min</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn label={focus.paused ? 'Reprendre' : 'Pause'} onClick={focus.paused ? resumeFocus : pauseFocus}>
              {focus.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </IconBtn>
            <IconBtn label="Arrêter et enregistrer le temps" onClick={() => finish(false)}>
              <Square className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Terminer la tâche" onClick={() => finish(true)} className="bg-success/10 text-success hover:bg-success/20">
              <Check className="h-4 w-4" />
            </IconBtn>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IconBtn({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn('rounded-xl p-2 text-muted transition hover:bg-surface hover:text-foreground', className)}>
      {children}
    </button>
  );
}
