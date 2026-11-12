'use client';

import * as React from 'react';
import { Check, Search } from 'lucide-react';
import { Button, inputClass, Modal, PointsPicker, Segmented, Skeleton } from '@/components/ui';
import { importJiraIssues, useJiraIssues } from '@/lib/client/data';
import { cn } from '@/lib/utils';
import { relativeDayLabel } from '@/lib/dates';

interface JiraImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  /** Clés déjà présentes sur la journée. */
  existingKeys: Set<string>;
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-surface text-muted',
  indeterminate: 'bg-accent/10 text-accent',
  done: 'bg-success/10 text-success',
};

/** Importe des tickets Jira comme tâches de la journée, avec leurs points. */
export function JiraImportModal({ isOpen, onClose, date, existingKeys }: JiraImportModalProps) {
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [scope, setScope] = React.useState<'mine' | 'all'>('mine');
  const [selected, setSelected] = React.useState<Map<string, number>>(new Map());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  React.useEffect(() => {
    if (!isOpen) setSelected(new Map());
  }, [isOpen]);

  const { data: issues, isLoading, error } = useJiraIssues(isOpen, debounced, scope);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, 5);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    const res = await importJiraIssues(
      date,
      Array.from(selected, ([key, points]) => ({ key, points })),
    );
    setSaving(false);
    if (res) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Importer depuis Jira"
      description={`Ajouter des tickets à ${relativeDayLabel(date).toLowerCase()} et leur attribuer des points`}
      footer={
        <>
          <span className="mr-auto text-sm text-muted">{selected.size} sélectionné(s)</span>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={selected.size === 0} isLoading={saving}>
            Importer
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-card px-1 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par texte ou clé (PROJ-123)…"
            className={cn(inputClass, 'pl-9')}
          />
        </div>
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: 'Mes tickets ouverts' },
            { value: 'all', label: 'Tous les tickets' },
          ]}
        />
      </div>

      {error && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{(error as Error).message}</p>}
      {isLoading && !issues && (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      )}
      {issues?.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun ticket trouvé.</p>}

      <ul className="space-y-1.5">
        {issues?.map((issue) => {
          const already = existingKeys.has(issue.key);
          const isSelected = selected.has(issue.key);
          return (
            <li
              key={issue.key}
              className={cn(
                'rounded-xl border p-3 transition',
                isSelected ? 'border-accent/50 bg-accent/5' : 'border-border',
                already && 'opacity-50',
              )}
            >
              <button
                disabled={already}
                onClick={() => toggle(issue.key)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                    isSelected ? 'border-accent bg-accent text-white' : 'border-border',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#0052CC] dark:text-[#4C9AFF]">{issue.key}</span>
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', STATUS_STYLE[issue.statusCategory] ?? STATUS_STYLE.new)}>
                      {issue.status}
                    </span>
                    {already && <span className="text-[10px] text-muted">déjà ajouté</span>}
                  </span>
                  <span className="mt-0.5 block text-sm">{issue.summary}</span>
                  <span className="text-xs text-muted">{issue.projectName} · {issue.issueType}</span>
                </span>
              </button>
              {isSelected && (
                <div className="mt-3 flex items-center gap-3 pl-8">
                  <span className="text-xs text-muted">Points</span>
                  <PointsPicker
                    compact
                    value={selected.get(issue.key)!}
                    onChange={(p) => setSelected((prev) => new Map(prev).set(issue.key, p))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
