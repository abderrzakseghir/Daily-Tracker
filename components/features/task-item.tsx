'use client';

import * as React from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { Check, GripVertical, Pin, Play, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, fromMinutes, toMinutes } from '@/lib/planner';
import { PointsBadge } from '@/components/ui';
import { JiraChip } from './jira-chip';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, CATEGORY_LABELS, type Task } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onFocus: (task: Task) => void;
  onDragEnd: () => void;
  focused?: boolean;
  readOnly?: boolean;
}

export function TaskItem({ task, onToggle, onOpen, onFocus, onDragEnd, focused, readOnly }: TaskItemProps) {
  const controls = useDragControls();
  const done = task.status === 'done';
  const inProgress = task.status === 'in_progress';
  const color = CATEGORY_COLORS[task.category];
  const end = task.startTime ? fromMinutes(toMinutes(task.startTime) + task.durationMinutes) : null;

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px -8px rgba(0,0,0,0.25)', zIndex: 10 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-2xl border border-border bg-card p-2.5 pr-3 transition-colors sm:gap-3',
        'hover:border-accent/30',
        focused && 'ring-2 ring-accent/50',
        // Tâche en cours de création côté serveur : pas encore manipulable
        task.id.startsWith('tmp-') && 'pointer-events-none opacity-60',
      )}
    >
      {!readOnly && (
        <button
          className="cursor-grab touch-none rounded-lg p-1 text-muted/50 transition hover:text-muted active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Réordonner"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onToggle(task)}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-success bg-success text-white' : 'border-border hover:border-success',
        )}
        style={inProgress ? { borderColor: color, background: `conic-gradient(${color} 0 50%, transparent 50% 100%)` } : undefined}
        aria-label={done ? 'Marquer comme à faire' : 'Marquer comme terminée'}
      >
        {done && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </motion.button>

      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
        <p className={cn('truncate text-sm font-medium', done && 'text-muted line-through decoration-muted/50')}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1" title={CATEGORY_LABELS[task.category]}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="hidden sm:inline">{CATEGORY_LABELS[task.category]}</span>
            <span className="sm:hidden">{CATEGORY_EMOJIS[task.category]}</span>
          </span>
          {task.startTime && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              {task.pinned && <Pin className="h-3 w-3" />}
              {task.startTime}–{end}
            </span>
          )}
          <span className="font-medium text-foreground/80">{formatDuration(task.durationMinutes)}</span>
          {task.actualMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5" title="Temps mesuré (focus)">
              <Timer className="h-3 w-3" /> {formatDuration(task.actualMinutes)}
            </span>
          )}
          <JiraChip task={task} />
        </div>
      </button>

      <PointsBadge points={task.points} />

      {!done && !readOnly && (
        <button
          onClick={() => onFocus(task)}
          className="rounded-xl p-2 text-muted opacity-100 transition hover:bg-accent/10 hover:text-accent sm:opacity-0 sm:group-hover:opacity-100"
          title="Démarrer une session focus"
          aria-label="Démarrer une session focus"
        >
          <Play className="h-4 w-4" />
        </button>
      )}
    </Reorder.Item>
  );
}
