'use client';

import * as React from 'react';
import { Category, Duration, CATEGORIES, CATEGORY_LABELS, DURATIONS, DURATION_LABELS, Task, JiraTicket } from '@/types';
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
  jiraTickets?: JiraTicket[];
}

export function TaskForm({
  onSubmit,
  initialTask,
  mode = 'create',
  onCancel,
  jiraTickets = [],
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
  const [showDropdown, setShowDropdown] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Filter Jira tickets based on what the user types
  const filteredTickets = React.useMemo(() => {
    if (!jiraTickets.length) return [];
    const q = description.toLowerCase().trim();
    if (!q) return jiraTickets.slice(0, 8);
    return jiraTickets
      .filter(
        (t) =>
          t.key.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [jiraTickets, description]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTicket = (ticket: JiraTicket) => {
    setDescription(`[${ticket.key}] ${ticket.summary}`);
    setShowDropdown(false);
  };

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

  const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('progress') || s.includes('cours'))
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    if (s.includes('done') || s.includes('termin'))
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    return 'bg-muted/50 text-muted';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Description field with optional Jira combobox */}
      <div ref={wrapperRef} className="relative">
        <Input
          placeholder={
            jiraTickets.length
              ? 'Décrivez votre tâche ou sélectionnez un ticket Jira…'
              : "Qu'avez-vous fait ?"
          }
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDropdown(false);
          }}
          className="text-base"
          autoFocus
        />

        {/* Jira ticket dropdown */}
        {showDropdown && filteredTickets.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-border">
              {/* Jira logo */}
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11.75 2L2 11.75l4.5 4.5L11.75 11l5.25 5.25L21.5 11.75 11.75 2z" fill="#2684FF"/>
                <path d="M11.75 22l9.75-9.75-4.5-4.5L11.75 13l-5.25-5.25L2 12.25 11.75 22z" fill="#2684FF" opacity=".6"/>
              </svg>
              <span className="text-xs text-muted font-medium">
                Tickets Jira assignés — cliquez pour sélectionner
              </span>
            </div>
            <ul>
              {filteredTickets.map((ticket) => (
                <li key={ticket.key}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep input focus during selection
                      handleSelectTicket(ticket);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className="shrink-0 font-mono text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      {ticket.key}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{ticket.summary}</p>
                      <p className="text-xs text-muted">{ticket.project}</p>
                    </div>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
