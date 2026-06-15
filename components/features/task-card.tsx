'use client';

import * as React from 'react';
import { Task, CATEGORY_LABELS, CATEGORY_COLORS, DURATION_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Pencil, Trash2, Clock, Tag } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggle?: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  readonly?: boolean;
}

export function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  readonly = false,
}: TaskCardProps) {
  const categoryColor = CATEGORY_COLORS[task.category];

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-card p-4 transition-all duration-200',
        'hover:border-accent/30 hover:shadow-soft',
        task.completed && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {!readonly && (
          <button
            onClick={() => onToggle?.(task.id)}
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200',
              task.completed
                ? 'border-success bg-success text-white'
                : 'border-border hover:border-accent'
            )}
          >
            {task.completed && <Check className="h-3 w-3" />}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium leading-relaxed',
              task.completed && 'line-through text-muted'
            )}
          >
            {task.description}
          </p>

          {/* Meta */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: categoryColor, color: categoryColor }}
            >
              <Tag className="h-3 w-3" />
              {CATEGORY_LABELS[task.category]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3" />
              {task.duration === 'custom'
                ? `${task.customDuration} min`
                : DURATION_LABELS[task.duration]}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        {!readonly && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit?.(task)}
              className="text-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete?.(task.id)}
              className="text-muted hover:text-error"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
