'use client';

import * as React from 'react';
import { PlannedTask, Category, CATEGORIES, CATEGORY_LABELS, Duration, DURATIONS, DURATION_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Calendar, Tag } from 'lucide-react';

interface PlannedTaskListProps {
  tasks: PlannedTask[];
  onAdd: (task: Omit<PlannedTask, 'id' | 'createdAt'>) => void;
  onRemove: (taskId: string) => void;
  readonly?: boolean;
}

export function PlannedTaskList({
  tasks,
  onAdd,
  onRemove,
  readonly = false,
}: PlannedTaskListProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<Category>('development');
  const [estimatedDuration, setEstimatedDuration] = React.useState<Duration>('1h');

  const categoryOptions: SelectOption[] = CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

  const durationOptions: SelectOption[] = DURATIONS.filter(d => d !== 'custom').map((dur) => ({
    value: dur,
    label: DURATION_LABELS[dur],
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAdd({
      description: description.trim(),
      category,
      estimatedDuration,
    });

    setDescription('');
    setCategory('development');
    setEstimatedDuration('1h');
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      {/* List */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3 group"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted" />
                <span className="text-sm">{task.description}</span>
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[task.category]}
                </Badge>
              </div>
              {!readonly && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-error"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {!readonly && (
        <>
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <Input
                placeholder="Tâche prévue pour demain..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select
                    options={categoryOptions}
                    value={category}
                    onChange={(v) => setCategory(v as Category)}
                    placeholder="Catégorie"
                  />
                </div>
                <div className="flex-1">
                  <Select
                    options={durationOptions}
                    value={estimatedDuration}
                    onChange={(v) => setEstimatedDuration(v as Duration)}
                    placeholder="Durée estimée"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAdding(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={!description.trim()}>
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="w-full justify-center border-dashed"
            >
              <Plus className="h-4 w-4" />
              Ajouter une tâche prévue
            </Button>
          )}
        </>
      )}

      {/* Empty state */}
      {tasks.length === 0 && !isAdding && (
        <p className="text-center text-sm text-muted py-4">
          Aucune tâche prévue pour demain
        </p>
      )}
    </div>
  );
}
