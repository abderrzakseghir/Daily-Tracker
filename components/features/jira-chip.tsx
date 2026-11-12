'use client';

import { AlertTriangle, CheckCircle2, CloudUpload, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/planner';
import type { Task } from '@/types';

export type JiraSyncState = 'none' | 'synced' | 'pending' | 'error' | 'linked';

export function jiraSyncState(t: Task): JiraSyncState {
  if (!t.jiraKey) return 'none';
  if (t.jiraSyncError) return 'error';
  if (t.status !== 'done') return t.jiraWorklogId ? 'pending' : 'linked';
  if (!t.jiraWorklogId || t.jiraSyncedMinutes !== t.durationMinutes) return 'pending';
  return 'synced';
}

export function JiraLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.83-.83H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.39 1.95 4.34 4.34 4.34v-9.57a.84.84 0 0 0-.84-.84H2z" />
    </svg>
  );
}

export function JiraChip({ task, className }: { task: Task; className?: string }) {
  if (!task.jiraKey) return null;
  const state = jiraSyncState(task);
  const Icon = state === 'synced' ? CheckCircle2 : state === 'error' ? AlertTriangle : state === 'pending' ? CloudUpload : null;
  const title =
    state === 'synced'
      ? `Worklog Jira à jour (${formatDuration(task.jiraSyncedMinutes ?? 0)})`
      : state === 'error'
        ? task.jiraSyncError ?? 'Erreur Jira'
        : state === 'pending'
          ? 'Worklog à synchroniser'
          : 'Lié à Jira — le temps sera loggé quand la tâche sera terminée';

  return (
    <a
      href={task.jiraUrl ?? '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition hover:underline',
        state === 'error'
          ? 'bg-error/10 text-error'
          : 'bg-[#0052CC]/10 text-[#0052CC] dark:bg-[#4C9AFF]/15 dark:text-[#4C9AFF]',
        className,
      )}
    >
      <JiraLogo className="h-3 w-3" />
      {task.jiraKey}
      {Icon && <Icon className={cn('h-3 w-3', state === 'synced' && 'text-success', state === 'pending' && 'text-warning')} />}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}
