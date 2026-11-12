'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Plus, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseQuickAdd } from '@/lib/quick-add';
import { formatDuration } from '@/lib/planner';
import { createTask } from '@/lib/client/data';
import { PointsPicker } from '@/components/ui';
import { CATEGORY_EMOJIS, CATEGORY_LABELS, type User } from '@/types';

interface QuickAddProps {
  date: string;
  user: User;
  onOpenAdvanced: () => void;
}

/**
 * Barre d'ajout rapide. Raccourci clavier : « N ».
 * Syntaxe : !7 (points) · #réunion · 1h30 · @14h · +PROJ (créer dans Jira) · PROJ-12 (lier)
 */
export function QuickAdd({ date, user, onOpenAdvanced }: QuickAddProps) {
  const [value, setValue] = React.useState('');
  const [points, setPoints] = React.useState(5);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const parsed = React.useMemo(() => parseQuickAdd(value), [value]);
  const settings = user.settings;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.title) return;
    const jiraProject =
      parsed.jiraProject ??
      (settings.autoCreateJiraIssue && user.jira.connected && !parsed.jiraKey ? settings.defaultJiraProject : null);
    createTask(
      {
        date,
        title: parsed.title,
        points: parsed.points ?? points,
        category: parsed.category ?? settings.defaultCategory,
        manualDuration: parsed.manualDuration ?? null,
        startTime: parsed.startTime ?? null,
        pinned: Boolean(parsed.startTime),
        createInJiraProject: user.jira.connected ? jiraProject : null,
        jiraKey: user.jira.connected ? parsed.jiraKey ?? null : null,
      },
      settings,
    );
    setValue('');
  };

  const chips = [
    parsed.points && `${parsed.points} pts`,
    parsed.category && `${CATEGORY_EMOJIS[parsed.category]} ${CATEGORY_LABELS[parsed.category]}`,
    parsed.manualDuration && `⏱ ${formatDuration(parsed.manualDuration)}`,
    parsed.startTime && `📌 ${parsed.startTime}`,
    parsed.jiraProject && `Jira : nouveau ticket ${parsed.jiraProject}`,
    parsed.jiraKey && `Jira : lier ${parsed.jiraKey}`,
  ].filter(Boolean) as string[];

  return (
    <form
      onSubmit={submit}
      className={cn(
        'rounded-2xl border bg-card p-2 transition-shadow',
        focused ? 'border-accent/50 shadow-glow' : 'border-border shadow-soft',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Plus className="h-5 w-5" />
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ajouter une tâche…  (N)"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-muted focus:outline-none"
          enterKeyHint="done"
          maxLength={300}
        />
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="rounded-xl p-2 text-muted transition hover:bg-surface hover:text-foreground"
          title="Plus d'options"
          aria-label="Plus d'options"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          type="submit"
          disabled={!parsed.title}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-40"
        >
          <span className="hidden sm:inline">Ajouter</span>
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {(focused || value) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-1 pb-1 pt-3">
              {parsed.points == null && (
                <div className="flex items-center gap-3" onMouseDown={(e) => e.preventDefault()}>
                  <span className="w-14 shrink-0 text-xs font-medium text-muted">Points</span>
                  <PointsPicker value={points} onChange={setPoints} compact />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {c}
                  </span>
                ))}
                {chips.length === 0 && (
                  <span className="text-xs text-muted">
                    Astuce : <code className="rounded bg-surface px-1">!7</code> points ·{' '}
                    <code className="rounded bg-surface px-1">#réunion</code> ·{' '}
                    <code className="rounded bg-surface px-1">1h30</code> ·{' '}
                    <code className="rounded bg-surface px-1">@14h</code>
                    {user.jira.connected && (
                      <>
                        {' '}· <code className="rounded bg-surface px-1">+PROJ</code> crée le ticket Jira
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
