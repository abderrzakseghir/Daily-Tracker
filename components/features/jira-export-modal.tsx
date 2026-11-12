'use client';

import * as React from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Button, inputClass, Modal } from '@/components/ui';
import { exportToJira, useJiraProjects } from '@/lib/client/data';
import { formatDuration } from '@/lib/planner';
import { relativeDayLabel } from '@/lib/dates';
import { toast } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

interface JiraExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tasks: Task[];
  defaultProject: string | null;
}

/** Crée sur Jira les tâches de la journée qui n'y sont pas encore et aligne les temps. */
export function JiraExportModal({ isOpen, onClose, date, tasks, defaultProject }: JiraExportModalProps) {
  const { data: projects, error } = useJiraProjects(isOpen);
  const [project, setProject] = React.useState(defaultProject ?? '');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const fresh = tasks.filter((t) => !t.jiraKey && !t.id.startsWith('tmp-'));
  const linked = tasks.filter((t) => t.jiraKey);

  // Toutes les nouvelles tâches cochées à chaque ouverture
  React.useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set(fresh.map((t) => t.id)));
    setProject((p) => p || defaultProject || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = fresh.filter((t) => selected.has(t.id)).length;
  const canSubmit = count > 0 ? Boolean(project) : linked.length > 0;

  const submit = async () => {
    setSaving(true);
    const res = await exportToJira(date, count > 0 ? project : null, Array.from(selected));
    setSaving(false);
    if (!res) return;
    if (!res.warning) {
      toast(
        res.created > 0
          ? `${res.created} ticket(s) créé(s) sur Jira, temps à jour`
          : 'Temps Jira mis à jour',
        'success',
      );
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Exporter vers Jira"
      description={`Créer les tickets de ${relativeDayLabel(date).toLowerCase()} et y enregistrer le temps`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit} isLoading={saving}>
            {count > 0 ? `Créer ${count} ticket(s)` : 'Mettre à jour les temps'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {fresh.length > 0 && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Projet Jira</span>
            <select value={project} onChange={(e) => setProject(e.target.value)} className={inputClass}>
              <option value="">— Choisir un projet —</option>
              {projects?.map((p) => (
                <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
              ))}
            </select>
            {error && <span className="block text-xs text-error">{(error as Error).message}</span>}
          </label>
        )}

        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            À créer sur Jira ({fresh.length})
          </h3>
          {fresh.length === 0 ? (
            <p className="rounded-xl bg-surface p-3 text-sm text-muted">
              Toutes les tâches de la journée ont déjà un ticket Jira.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {fresh.map((t) => {
                const on = selected.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => toggle(t.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                        on ? 'border-accent/50 bg-accent/5' : 'border-border',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                          on ? 'border-accent bg-accent text-white' : 'border-border',
                        )}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                      <TimeLabel task={t} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {linked.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Déjà sur Jira ({linked.length}) — temps mis à jour
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {linked.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <a
                    href={t.jiraUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0052CC] hover:underline dark:text-[#4C9AFF]"
                  >
                    {t.jiraKey} <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <TimeLabel task={t} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-muted">
          Chaque ticket vous est assigné avec une estimation égale à la durée planifiée. Le temps
          passé est enregistré sur les tâches terminées, à leur horaire planifié. Vous pouvez
          relancer l&apos;export à tout moment : seules les nouvelles tâches sont créées.
        </p>
      </div>
    </Modal>
  );
}

function TimeLabel({ task }: { task: Task }) {
  const done = task.status === 'done';
  return (
    <span className={cn('shrink-0 text-xs tabular-nums', done ? 'text-success' : 'text-muted')}>
      {task.startTime ? `${task.startTime} · ` : ''}
      {formatDuration(task.durationMinutes)}
      {done ? ' · terminée' : ''}
    </span>
  );
}
