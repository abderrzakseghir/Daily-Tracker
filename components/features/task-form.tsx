'use client';

import * as React from 'react';
import { Category, Duration, CATEGORIES, CATEGORY_LABELS, DURATIONS, DURATION_LABELS, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { generateId } from '@/lib/utils';
import { Plus, Save } from 'lucide-react';

interface TaskFormProps {
  onSubmit: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialTask?: Task;
  mode?: 'create' | 'edit';
  onCancel?: () => void;
}

export function TaskForm({
  onSubmit,
  initialTask,
  mode = 'create',
  onCancel,
}: TaskFormProps) {
  const [description, setDescription] = React.useState(
    initialTask?.description || ''
  );
  const [category, setCategory] = React.useState<Category>(
    initialTask?.category || 'development'
  );
  const [duration, setDuration] = React.useState<Duration>(
    initialTask?.duration || '1h'
  );
  const [customDuration, setCustomDuration] = React.useState(
    initialTask?.customDuration?.toString() || ''
  );

  const categoryOptions: SelectOption[] = CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

  const durationOptions: SelectOption[] = DURATIONS.map((dur) => ({
    value: dur,
    label: DURATION_LABELS[dur],
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onSubmit({
      description: description.trim(),
      category,
      duration,
      customDuration: duration === 'custom' ? parseInt(customDuration) || 0 : undefined,
      completed: initialTask?.completed || false,
    });

    // Reset form if creating
    if (mode === 'create') {
      setDescription('');
      setCategory('development');
      setDuration('1h');
      setCustomDuration('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Qu'avez-vous fait ?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="text-base"
        autoFocus
      />

      <div className="flex flex-col sm:flex-row gap-3">
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
            value={duration}
            onChange={(v) => setDuration(v as Duration)}
            placeholder="Durée"
          />
        </div>
        {duration === 'custom' && (
          <div className="w-24">
            <Input
              type="number"
              placeholder="Min"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              min={1}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {mode === 'edit' && onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={!description.trim()}
          className="min-w-[120px]"
        >
          {mode === 'create' ? (
            <>
              <Plus className="h-4 w-4" />
              Ajouter
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
