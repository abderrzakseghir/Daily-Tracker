'use client';

import * as React from 'react';
import { CalendarClock, Link2, Play, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { Button, Field, inputClass, Modal, PointsPicker, Segmented, pointsLabel, Switch } from '@/components/ui';
import { JiraChip, JiraLogo } from './jira-chip';
import { cn } from '@/lib/utils';
import { formatDuration, parseDuration } from '@/lib/planner';
import { createTask, deleteTask, syncDay, updateTask, useJiraProjects } from '@/lib/client/data';
import { useUi, toast } from '@/lib/store';
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  type Category,
  type Task,
  type TaskStatus,
  type User,
} from '@/types';

export interface TaskDraft {
  date: string;
  startTime?: string | null;
}

interface TaskEditorProps {
  /** Tâche existante, ou brouillon pour une création. */
  task: Task | TaskDraft | null;
  user: User;
  onClose: () => void;
}

const isTask = (t: Task | TaskDraft): t is Task => 'id' in t;

export function TaskEditor({ task, user, onClose }: TaskEditorProps) {
  return (
    <Modal
      isOpen={task !== null}
      onClose={onClose}
      size="lg"
      title={task && isTask(task) ? 'Modifier la tâche' : 'Nouvelle tâche'}
    >
      {task && <EditorBody key={isTask(task) ? task.id : 'new'} task={task} user={user} onClose={onClose} />}
    </Modal>
  );
}

function EditorBody({ task, user, onClose }: { task: Task | TaskDraft; user: User; onClose: () => void }) {
  const existing = isTask(task) ? task : null;
  const settings = user.settings;
  const jiraConnected = user.jira.connected;
  const { data: projects } = useJiraProjects(jiraConnected);
  const startFocus = useUi((s) => s.startFocus);

  const [title, setTitle] = React.useState(existing?.title ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [category, setCategory] = React.useState<Category>(existing?.category ?? settings.defaultCategory);
  const [points, setPoints] = React.useState(existing?.points ?? 5);
  const [status, setStatus] = React.useState<TaskStatus>(existing?.status ?? 'todo');
  const [date, setDate] = React.useState(task.date);
  const [manual, setManual] = React.useState(existing?.manualDuration != null);
  const [durationText, setDurationText] = React.useState(
    existing?.manualDuration ? formatDuration(existing.manualDuration).replace(' ', '') : '1h',
  );
  const initialStart = existing ? (existing.pinned ? existing.startTime : null) : task.startTime ?? null;
  const [fixedTime, setFixedTime] = React.useState(initialStart != null);
  const [startTime, setStartTime] = React.useState(initialStart ?? existing?.startTime ?? settings.workdayStart);
  const [jiraMode, setJiraMode] = React.useState<'none' | 'create' | 'link'>(
    !existing && settings.autoCreateJiraIssue && settings.defaultJiraProject ? 'create' : 'none',
  );
  const [jiraProject, setJiraProject] = React.useState(settings.defaultJiraProject ?? '');
  const [jiraKey, setJiraKey] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const duration = manual ? parseDuration(durationText) : null;
  const durationInvalid = manual && (duration == null || duration < 5);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || durationInvalid) return;
    setSaving(true);
    const fields = {
      title: title.trim(),
      description,
      category,
      points,
      status,
      date,
      manualDuration: manual ? duration : null,
      startTime: fixedTime ? startTime : null,
      pinned: fixedTime,
    };
    const jira =
      jiraMode === 'create' && jiraProject
        ? { createInJiraProject: jiraProject }
        : jiraMode === 'link' && jiraKey.trim()
          ? { jiraKey: jiraKey.trim().toUpperCase() }
          : existing
            ? {}
            : { createInJiraProject: null }; // « Aucun » explicite : pas de création automatique

    onClose();
    if (existing) await updateTask(existing, { ...fields, ...jira }, settings);
    else await createTask({ ...fields, ...jira }, settings);
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <input
          autoFocus={!existing}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Qu'avez-vous à faire ?"
          className="w-full border-0 bg-transparent text-xl font-semibold placeholder:text-muted/60 focus:outline-none"
          maxLength={300}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes, contexte, lien… (optionnel)"
          rows={2}
          className={cn(inputClass, 'h-auto resize-none py-2')}
        />
      </div>

      <Field label="Points" hint={`${points}/10 · ${pointsLabel(points)}`}>
        <PointsPicker value={points} onChange={setPoints} />
      </Field>

      <Field label="Catégorie">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                category === c ? 'border-transparent text-white' : 'border-border hover:bg-surface',
              )}
              style={category === c ? { backgroundColor: CATEGORY_COLORS[c] } : undefined}
            >
              {CATEGORY_EMOJIS[c]} {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Statut">
          <Segmented
            value={status}
            onChange={setStatus}
            size="sm"
            options={(['todo', 'in_progress', 'done'] as const).map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
          />
        </Field>
        <Field label="Jour">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="space-y-3 rounded-2xl bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="h-4 w-4 text-accent" /> Temps
        </div>
        <Switch
          checked={manual}
          onChange={setManual}
          label="Durée fixée à la main"
          description={
            manual
              ? 'Exemples : 45min, 1h30, 2h'
              : settings.durationMode === 'proportional'
                ? 'Calculée selon les points (répartition de la journée)'
                : `Calculée selon les points (${settings.minutesPerPoint} min/point)`
          }
        />
        {manual && (
          <input
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            className={cn(inputClass, durationInvalid && 'border-error')}
            placeholder="1h30"
          />
        )}
        <Switch
          checked={fixedTime}
          onChange={setFixedTime}
          label="Horaire fixe"
          description={fixedTime ? 'La tâche reste à cet horaire' : 'Placée automatiquement dans la journée'}
        />
        {fixedTime && (
          <input type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        )}
        {existing && (
          <p className="text-xs text-muted">
            Planifié : {existing.startTime ?? '—'} · {formatDuration(existing.durationMinutes)}
            {existing.actualMinutes > 0 && ` · mesuré : ${formatDuration(existing.actualMinutes)}`}
          </p>
        )}
      </div>

      {/* ── Jira ── */}
      <div className="space-y-3 rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <JiraLogo className="h-4 w-4 text-[#0052CC] dark:text-[#4C9AFF]" /> Jira
        </div>
        {!jiraConnected ? (
          <p className="text-sm text-muted">
            Connectez Jira dans les <a href="/settings" className="text-accent hover:underline">paramètres</a> pour créer des tickets et logger le temps automatiquement.
          </p>
        ) : existing?.jiraKey ? (
          <div className="flex flex-wrap items-center gap-2">
            <JiraChip task={existing} />
            {existing.jiraSyncError && <p className="w-full text-xs text-error">{existing.jiraSyncError}</p>}
            <Button type="button" size="sm" variant="secondary" onClick={() => { syncDay(existing.date); onClose(); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Synchroniser
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { updateTask(existing, { jiraKey: null }, settings); onClose(); }}>
              <Unlink className="h-3.5 w-3.5" /> Délier
            </Button>
            <p className="w-full text-xs text-muted">
              Le temps est loggé sur le ticket quand la tâche passe à « Terminée », puis tenu à jour.
            </p>
          </div>
        ) : (
          <>
            <Segmented
              value={jiraMode}
              onChange={setJiraMode}
              size="sm"
              options={[
                { value: 'none', label: 'Aucun' },
                { value: 'create', label: 'Créer un ticket' },
                { value: 'link', label: 'Lier un ticket' },
              ]}
            />
            {jiraMode === 'create' && (
              <select value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} className={inputClass}>
                <option value="">Choisir un projet…</option>
                {projects?.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            )}
            {jiraMode === 'link' && (
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={jiraKey}
                  onChange={(e) => setJiraKey(e.target.value)}
                  placeholder="PROJ-123"
                  className={cn(inputClass, 'pl-9 uppercase')}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {existing && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-error hover:bg-error/10 hover:text-error"
              onClick={() => {
                onClose();
                deleteTask(existing, settings);
                toast('Tâche supprimée', 'info');
              }}
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                startFocus({ taskId: existing.id, taskTitle: existing.title, date: existing.date, targetMinutes: settings.focusMinutes });
                if (existing.status === 'todo') updateTask(existing, { status: 'in_progress' }, settings);
                onClose();
              }}
            >
              <Play className="h-4 w-4" /> Focus
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" isLoading={saving} disabled={!title.trim() || durationInvalid}>
          {existing ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}
