'use client';

import * as React from 'react';
import { PlannedTask, Category, CATEGORIES, CATEGORY_LABELS, Duration, JiraTicket } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DurationPicker } from './duration-picker';
import { Plus, X, Calendar } from 'lucide-react';

interface PlannedTaskListProps {
  tasks: PlannedTask[];
  onAdd: (task: Omit<PlannedTask, 'id' | 'createdAt'>) => void;
  onRemove: (taskId: string) => void;
  readonly?: boolean;
  /** Optional list of Jira tickets to show in the description combobox. */
  jiraTickets?: JiraTicket[];
}

export function PlannedTaskList({
  tasks,
  onAdd,
  onRemove,
  readonly = false,
  jiraTickets = [],
}: PlannedTaskListProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<Category>('development');
  const [estimatedDuration, setEstimatedDuration] = React.useState<Duration>('1h');
  const [estimatedCustomDuration, setEstimatedCustomDuration] = React.useState<number | undefined>();
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
          t.project.toLowerCase().includes(q),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAdd({
      description: description.trim(),
      category,
      estimatedDuration,
      estimatedCustomDuration: estimatedDuration === 'custom' ? estimatedCustomDuration : undefined,
    });

    setDescription('');
    setCategory('development');
    setEstimatedDuration('1h');
    setEstimatedCustomDuration(undefined);
    setIsAdding(false);
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
              {/* Description + optional Jira combobox */}
              <div ref={wrapperRef} className="relative">
                <Input
                  placeholder={
                    jiraTickets.length
                      ? 'Tâche prévue ou ticket Jira…'
                      : 'Tâche prévue pour demain…'
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
                  autoFocus
                />

                {/* Jira ticket dropdown */}
                {showDropdown && filteredTickets.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-border">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M11.75 2L2 11.75l4.5 4.5L11.75 11l5.25 5.25L21.5 11.75 11.75 2z" fill="#2684FF"/>
                        <path d="M11.75 22l9.75-9.75-4.5-4.5L11.75 13l-5.25-5.25L2 12.25 11.75 22z" fill="#2684FF" opacity=".6"/>
                      </svg>
                      <span className="text-xs text-muted font-medium">
                        Tickets Jira — cliquez pour sélectionner
                      </span>
                    </div>
                    <ul>
                      {filteredTickets.map((ticket) => (
                        <li key={ticket.key}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
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
                  <DurationPicker
                    value={estimatedDuration}
                    customMinutes={estimatedCustomDuration}
                    onChange={(dur, mins) => {
                      setEstimatedDuration(dur);
                      setEstimatedCustomDuration(mins);
                    }}
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
