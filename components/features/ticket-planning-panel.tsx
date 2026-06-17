'use client';

import * as React from 'react';
import { RefreshCw, Wand2, Clock, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  autoScheduleTickets,
  formatDuration,
  getWeekDays,
  formatDateLabel,
  importanceBadgeClass,
  importanceToDuration,
  parseDurationInput,
} from '@/lib/timeblocking';
import type { PlannedJiraTicket } from '@/types';

// ─── Ticket Row ───────────────────────────────────────────────

interface TicketRowProps {
  ticket: PlannedJiraTicket;
  weekDays: string[];
  onUpdate: (updates: Partial<PlannedJiraTicket>) => void;
}

function TicketRow({ ticket, weekDays, onUpdate }: TicketRowProps) {
  const [durationRaw, setDurationRaw] = React.useState(
    ticket.durationMinutes != null ? String(ticket.durationMinutes) : '',
  );
  const [expanded, setExpanded] = React.useState(false);

  // Sync durationRaw if store value changes from outside (e.g. auto-schedule)
  React.useEffect(() => {
    setDurationRaw(ticket.durationMinutes != null ? String(ticket.durationMinutes) : '');
  }, [ticket.durationMinutes]);

  function commitDuration(raw: string) {
    if (raw.trim() === '') {
      onUpdate({ durationMinutes: null });
      return;
    }
    const parsed = parseDurationInput(raw);
    if (parsed !== null && parsed > 0) {
      onUpdate({ durationMinutes: parsed });
      setDurationRaw(String(parsed));
    } else {
      // revert to last valid value
      setDurationRaw(ticket.durationMinutes != null ? String(ticket.durationMinutes) : '');
    }
  }

  const autoDuration = importanceToDuration(ticket.importance);
  const effectiveDuration = ticket.durationMinutes ?? autoDuration;

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft transition-shadow hover:shadow-card">
      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={ticket.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-mono font-semibold text-accent hover:underline flex items-center gap-0.5 shrink-0"
            >
              {ticket.key}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                importanceBadgeClass(ticket.importance),
              )}
            >
              ★ {ticket.importance}/10
            </span>
            {ticket.scheduledDate && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
                <Clock className="h-2.5 w-2.5" />
                {formatDuration(effectiveDuration)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-0.5 line-clamp-1 text-foreground">
            {ticket.summary}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <span className="text-[10px] text-muted">{ticket.status}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </div>
      </button>

      {/* ── Expanded controls ── */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Importance slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Importance</span>
              <span
                className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded',
                  importanceBadgeClass(ticket.importance),
                )}
              >
                {ticket.importance} / 10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={ticket.importance}
              onChange={(e) => onUpdate({ importance: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted">
              <span>Faible</span>
              <span>Critique</span>
            </div>
          </div>

          {/* Duration input */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">
              Durée{' '}
              <span className="text-muted/60">(laisser vide = auto)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`auto: ${autoDuration}min`}
                value={durationRaw}
                onChange={(e) => setDurationRaw(e.target.value)}
                onBlur={(e) => commitDuration(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitDuration(durationRaw)}
                className={cn(
                  'flex-1 rounded-lg border px-2.5 py-1.5 text-sm bg-background',
                  'border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
                  'placeholder:text-muted/50',
                )}
              />
              <span className="text-xs text-muted whitespace-nowrap">
                ex: 90m, 1h30
              </span>
              {ticket.durationMinutes != null && (
                <button
                  onClick={() => {
                    onUpdate({ durationMinutes: null });
                    setDurationRaw('');
                  }}
                  className="text-muted hover:text-error transition-colors"
                  title="Réinitialiser en auto"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Day assignment */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted font-medium">Jour planifié</label>
            <select
              value={ticket.scheduledDate ?? ''}
              onChange={(e) =>
                onUpdate({ scheduledDate: e.target.value || null, scheduledStartTime: null })
              }
              className={cn(
                'w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background',
                'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
              )}
            >
              <option value="">Non planifié</option>
              {weekDays.map((date) => {
                const { day, num, isToday } = formatDateLabel(date);
                return (
                  <option key={date} value={date}>
                    {day} {num}{isToday ? ' (Aujourd\'hui)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────

interface TicketPlanningPanelProps {
  weekDays: string[];
}

export function TicketPlanningPanel({ weekDays }: TicketPlanningPanelProps) {
  const user = useStore((s) => s.user);
  const plannedTickets = useStore((s) => s.plannedTickets);
  const initPlannedTickets = useStore((s) => s.initPlannedTickets);
  const updatePlannedTicket = useStore((s) => s.updatePlannedTicket);
  const setPlannedAll = useStore((s) => s.initPlannedTickets); // re-use for bulk update

  const [isFetching, setIsFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'scheduled' | 'unscheduled'>('all');

  // ── Fetch from Jira API ──────────────────────────────────────
  async function fetchTickets() {
    if (!user?.jira) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/jira/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: user.jira.accessToken,
          cloudId: user.jira.cloudId,
          accountId: user.jira.accountId,
          cloudUrl: user.jira.cloudUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? 'Erreur lors du chargement des tickets');
        return;
      }
      initPlannedTickets(json.tickets);
    } catch {
      setFetchError('Impossible de contacter l\'API Jira.');
    } finally {
      setIsFetching(false);
    }
  }

  // ── Auto-schedule all days ──────────────────────────────────
  function handleAutoSchedule() {
    const bulkUpdates: PlannedJiraTicket[] = [...plannedTickets];

    weekDays.forEach((date) => {
      const dayTickets = bulkUpdates.filter((t) => t.scheduledDate === date);
      if (dayTickets.length === 0) return;
      try {
        const scheduled = autoScheduleTickets(dayTickets);
        scheduled.forEach((s) => {
          const idx = bulkUpdates.findIndex((t) => t.key === s.key);
          if (idx !== -1) bulkUpdates[idx] = s;
        });
      } catch (e: unknown) {
        alert(`Auto-schedule (${date}) : ${(e as Error).message}`);
      }
    });

    // Apply all computed values to the store
    bulkUpdates.forEach((t) => {
      if (t.scheduledDate) {
        updatePlannedTicket(t.key, {
          computedDurationMinutes: t.computedDurationMinutes,
          scheduledStartTime: t.scheduledStartTime,
        });
      }
    });
  }

  const filteredTickets = React.useMemo(() => {
    if (filter === 'scheduled') return plannedTickets.filter((t) => t.scheduledDate !== null);
    if (filter === 'unscheduled') return plannedTickets.filter((t) => t.scheduledDate === null);
    return plannedTickets;
  }, [plannedTickets, filter]);

  const scheduledCount = plannedTickets.filter((t) => t.scheduledDate !== null).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 space-y-3 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Tickets Jira</h2>
            <p className="text-xs text-muted mt-0.5">
              {plannedTickets.length} tickets · {scheduledCount} planifiés
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTickets}
              disabled={isFetching || !user?.jira}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'border border-border bg-background hover:bg-muted/10 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              {isFetching ? 'Chargement…' : 'Actualiser'}
            </button>
            <button
              onClick={handleAutoSchedule}
              disabled={scheduledCount === 0}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-accent text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Auto-schedule
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {(['all', 'scheduled', 'unscheduled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-1.5 transition-colors',
                filter === f
                  ? 'bg-accent text-white'
                  : 'bg-background text-muted hover:bg-muted/10',
              )}
            >
              {f === 'all' ? 'Tous' : f === 'scheduled' ? 'Planifiés' : 'Non planifiés'}
            </button>
          ))}
        </div>

        {!user?.jira && (
          <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
            Connectez votre compte Jira dans les paramètres pour charger les tickets.
          </p>
        )}
        {fetchError && (
          <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{fetchError}</p>
        )}
      </div>

      {/* ── Ticket list ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted text-sm">
              {plannedTickets.length === 0
                ? 'Aucun ticket chargé. Cliquez sur Actualiser.'
                : 'Aucun ticket dans cette catégorie.'}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketRow
              key={ticket.key}
              ticket={ticket}
              weekDays={weekDays}
              onUpdate={(updates) => updatePlannedTicket(ticket.key, updates)}
            />
          ))
        )}
      </div>
    </div>
  );
}
