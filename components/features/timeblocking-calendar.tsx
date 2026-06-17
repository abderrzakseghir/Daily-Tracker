'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, UploadCloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HOUR_PX,
  CALENDAR_START_HOUR,
  DISPLAY_HOURS,
  timeToTopPx,
  durationToHeightPx,
  formatDateLabel,
  formatDuration,
  getTicketColor,
  importanceBadgeClass,
  minutesToTimeString,
} from '@/lib/timeblocking';
import type { PlannedJiraTicket, FrozenDaySchedule } from '@/types';

// ─── Constants ────────────────────────────────────────────────

const TOTAL_HEIGHT = HOUR_PX * DISPLAY_HOURS; // px height of the grid body
const HOURS = Array.from(
  { length: DISPLAY_HOURS + 1 },
  (_, i) => CALENDAR_START_HOUR + i,
);

// ─── Ticket block ─────────────────────────────────────────────

interface TicketBlockProps {
  ticket: PlannedJiraTicket;
  /** Left offset 0-1 for overlap splitting. */
  leftFraction?: number;
  /** Width fraction 0-1 for overlap splitting. */
  widthFraction?: number;
  isFrozen?: boolean;
}

function TicketBlock({
  ticket,
  leftFraction = 0,
  widthFraction = 1,
  isFrozen = false,
}: TicketBlockProps) {
  const color = getTicketColor(ticket.projectKey || ticket.key);
  const top = ticket.scheduledStartTime ? timeToTopPx(ticket.scheduledStartTime) : 0;
  const height = durationToHeightPx(ticket.computedDurationMinutes);
  const isCompact = height < 36;

  return (
    <div
      title={`${ticket.key} · ${ticket.summary}\n${formatDuration(ticket.computedDurationMinutes)}${ticket.scheduledStartTime ? ` · ${ticket.scheduledStartTime}` : ''}`}
      className={cn(
        'absolute rounded-md overflow-hidden transition-opacity',
        color.bg,
        isFrozen ? 'opacity-80' : 'opacity-100',
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(2px + ${leftFraction * 100}%)`,
        width: `calc(${widthFraction * 100}% - 4px)`,
      }}
    >
      <div className="h-full flex flex-col justify-start px-1.5 py-1 text-white">
        <div className={cn('font-semibold truncate', isCompact ? 'text-[10px]' : 'text-xs')}>
          {ticket.key}
        </div>
        {!isCompact && (
          <div className="text-[10px] opacity-90 truncate leading-tight">{ticket.summary}</div>
        )}
        {height >= 50 && (
          <div className="text-[10px] opacity-75 mt-auto">
            {formatDuration(ticket.computedDurationMinutes)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Overlap layout helper ────────────────────────────────────

interface LayoutedTicket {
  ticket: PlannedJiraTicket;
  leftFraction: number;
  widthFraction: number;
}

/**
 * Groups tickets by overlapping time slots and assigns
 * horizontal fractions so they don't hide each other.
 */
function layoutTickets(tickets: PlannedJiraTicket[]): LayoutedTicket[] {
  // Sort by start time
  const sorted = [...tickets].sort((a, b) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMin(a.scheduledStartTime ?? '00:00') - toMin(b.scheduledStartTime ?? '00:00');
  });

  const result: LayoutedTicket[] = [];
  // Active "columns" — end times of tickets in each column
  const columns: number[] = [];

  for (const ticket of sorted) {
    if (!ticket.scheduledStartTime) continue;
    const [startH, startM] = ticket.scheduledStartTime.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = startMin + ticket.computedDurationMinutes;

    // Find the first column where the ticket fits
    let col = columns.findIndex((endTime) => endTime <= startMin);
    if (col === -1) {
      col = columns.length;
      columns.push(endMin);
    } else {
      columns[col] = endMin;
    }
    result.push({ ticket, leftFraction: 0, widthFraction: 1, _col: col } as LayoutedTicket & { _col: number });
  }

  // Second pass: determine max columns in each overlap group and set fractions
  const maxCols = columns.length || 1;
  return (result as Array<LayoutedTicket & { _col: number }>).map(({ _col, ...r }) => ({
    ...r,
    leftFraction: maxCols > 1 ? _col / maxCols : 0,
    widthFraction: maxCols > 1 ? 1 / maxCols : 1,
  }));
}

// ─── Day column ───────────────────────────────────────────────

interface DayColumnProps {
  date: string;
  tickets: PlannedJiraTicket[];
  frozenSchedule: FrozenDaySchedule | undefined;
  onValidate: (date: string) => void;
}

function DayColumn({ date, tickets, frozenSchedule, onValidate }: DayColumnProps) {
  const { day, num, isToday } = formatDateLabel(date);
  const scheduledTickets = tickets.filter(
    (t) => t.scheduledDate === date && t.scheduledStartTime,
  );
  const layouted = layoutTickets(scheduledTickets);
  const isFrozen = !!frozenSchedule;

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        className={cn(
          'flex flex-col items-center justify-between px-1 py-2 border-b border-border',
          isToday && 'bg-accent/5',
        )}
      >
        <div className="text-center">
          <div className={cn('text-[10px] font-medium uppercase tracking-wide', isToday ? 'text-accent' : 'text-muted')}>
            {day}
          </div>
          <div
            className={cn(
              'text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full mx-auto',
              isToday ? 'bg-accent text-white' : 'text-foreground',
            )}
          >
            {num}
          </div>
        </div>
        {scheduledTickets.length > 0 && (
          <button
            onClick={() => onValidate(date)}
            title={isFrozen ? 'Déjà validé' : 'Valider la journée (local uniquement)'}
            className={cn(
              'mt-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              isFrozen
                ? 'bg-success/15 text-success'
                : 'bg-accent/10 text-accent hover:bg-accent hover:text-white',
            )}
          >
            {isFrozen ? (
              <>
                <Lock className="h-2.5 w-2.5" />
                Validé
              </>
            ) : (
              <>
                <CheckCircle2 className="h-2.5 w-2.5" />
                Valider
              </>
            )}
          </button>
        )}
      </div>

      {/* Grid body */}
      <div
        className={cn('relative flex-1', isToday && 'bg-accent/[0.02]')}
        style={{ height: `${TOTAL_HEIGHT}px` }}
      >
        {/* Hourly lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute w-full border-t border-border/30"
            style={{ top: `${(h - CALENDAR_START_HOUR) * HOUR_PX}px` }}
          />
        ))}
        {/* Half-hour lines */}
        {HOURS.slice(0, -1).map((h) => (
          <div
            key={`${h}-30`}
            className="absolute w-full border-t border-border/10 border-dashed"
            style={{ top: `${(h - CALENDAR_START_HOUR) * HOUR_PX + HOUR_PX / 2}px` }}
          />
        ))}

        {/* Ticket blocks (frozen snapshot takes priority if frozen) */}
        {isFrozen
          ? layoutTickets(
              frozenSchedule!.tickets.filter((t) => t.scheduledStartTime),
            ).map(({ ticket, leftFraction, widthFraction }) => (
              <TicketBlock
                key={ticket.key}
                ticket={ticket}
                leftFraction={leftFraction}
                widthFraction={widthFraction}
                isFrozen
              />
            ))
          : layouted.map(({ ticket, leftFraction, widthFraction }) => (
              <TicketBlock
                key={ticket.key}
                ticket={ticket}
                leftFraction={leftFraction}
                widthFraction={widthFraction}
              />
            ))}
      </div>
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────

export interface TimeblockingCalendarProps {
  weekDays: string[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  plannedTickets: PlannedJiraTicket[];
  frozenSchedules: FrozenDaySchedule[];
  onValidateDay: (date: string) => void;
  /** When provided, a sync button appears on each validated day. */
  onSyncJira?: (date: string, tickets: PlannedJiraTicket[]) => Promise<void>;
}

export function TimeblockingCalendar({
  weekDays,
  weekOffset,
  onWeekChange,
  plannedTickets,
  frozenSchedules,
  onValidateDay,
  onSyncJira,
}: TimeblockingCalendarProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Scroll to 09:00 on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, []);

  // ── Jira sync state (per day) ──────────────────────────────────────────
  const [syncState, setSyncState] = React.useState<
    Record<string, 'idle' | 'loading' | 'done' | 'error'>
  >({});

  async function handleSyncDay(date: string, tickets: PlannedJiraTicket[]) {
    if (!onSyncJira) return;
    setSyncState((prev) => ({ ...prev, [date]: 'loading' }));
    try {
      await onSyncJira(date, tickets);
      setSyncState((prev) => ({ ...prev, [date]: 'done' }));
    } catch {
      setSyncState((prev) => ({ ...prev, [date]: 'error' }));
    }
  }

  const weekLabel = React.useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = new Date(weekDays[0] + 'T00:00:00');
    const last = new Date(weekDays[6] + 'T00:00:00');
    const fmt = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${fmt(first)} – ${fmt(last)} ${first.getFullYear()}`;
  }, [weekDays]);

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden shadow-soft">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="font-semibold text-foreground">Calendrier</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{weekLabel}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onWeekChange(weekOffset - 1)}
              className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors text-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onWeekChange(0)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
            >
              Auj.
            </button>
            <button
              onClick={() => onWeekChange(weekOffset + 1)}
              className="p-1.5 rounded-lg hover:bg-muted/10 transition-colors text-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto">
        {/* Use CSS Grid: time-label column + 7 day columns */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))',
            minWidth: '600px',
          }}
        >
          {/* ── Header row ── */}
          {/* Empty corner */}
          <div className="sticky top-0 z-10 bg-card border-b border-r border-border" />
          {weekDays.map((date) => {
            const { day, num, isToday } = formatDateLabel(date);
            const frozen = frozenSchedules.find((s) => s.date === date);
            return (
              <div
                key={date}
                className={cn(
                  'sticky top-0 z-10 border-b border-r border-border bg-card',
                  isToday && 'bg-accent/5',
                )}
              >
                <div className="flex flex-col items-center py-2 gap-1">
                  <span
                    className={cn(
                      'text-[10px] font-medium uppercase tracking-wide',
                      isToday ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {day}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full',
                      isToday ? 'bg-accent text-white' : 'text-foreground',
                    )}
                  >
                    {num}
                  </span>
                  {frozen ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-success">
                        <Lock className="h-2.5 w-2.5" />
                        Validé
                      </span>
                      {onSyncJira && (
                        <button
                          onClick={() => handleSyncDay(date, frozen.tickets)}
                          disabled={
                            syncState[date] === 'loading' ||
                            syncState[date] === 'done'
                          }
                          title={
                            syncState[date] === 'done'
                              ? 'Temps déjà envoyés sur Jira'
                              : 'Envoyer les temps sur Jira'
                          }
                          className={cn(
                            'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-default',
                            syncState[date] === 'done'
                              ? 'bg-success/15 text-success'
                              : syncState[date] === 'error'
                              ? 'bg-error/10 text-error hover:bg-error hover:text-white'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white',
                          )}
                        >
                          {syncState[date] === 'loading' ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : syncState[date] === 'done' ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <UploadCloud className="h-2.5 w-2.5" />
                          )}
                          {syncState[date] === 'loading'
                            ? '…'
                            : syncState[date] === 'done'
                            ? 'Envoyé ✓'
                            : syncState[date] === 'error'
                            ? 'Réessayer'
                            : 'Jira ↑'}
                        </button>
                      )}
                    </div>
                  ) : (
                    plannedTickets.some((t) => t.scheduledDate === date) && (
                      <button
                        onClick={() => onValidateDay(date)}
                        className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Valider
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Time + day rows ── */}
          <div
            className="relative border-r border-border"
            style={{ height: `${TOTAL_HEIGHT}px` }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted select-none"
                style={{ top: `${(h - CALENDAR_START_HOUR) * HOUR_PX - 7}px` }}
              >
                {minutesToTimeString(h * 60)}
              </div>
            ))}
          </div>

          {weekDays.map((date) => {
            const frozen = frozenSchedules.find((s) => s.date === date);
            const isToday = date === new Date().toISOString().split('T')[0];
            const dayTickets = frozen
              ? frozen.tickets.filter((t) => t.scheduledStartTime)
              : plannedTickets.filter((t) => t.scheduledDate === date && t.scheduledStartTime);

            const layouted = layoutTickets(dayTickets);

            return (
              <div
                key={date}
                className={cn(
                  'relative border-r border-border',
                  isToday && 'bg-accent/[0.02]',
                )}
                style={{ height: `${TOTAL_HEIGHT}px` }}
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/30"
                    style={{ top: `${(h - CALENDAR_START_HOUR) * HOUR_PX}px` }}
                  />
                ))}
                {/* Half-hour dashed lines */}
                {HOURS.slice(0, -1).map((h) => (
                  <div
                    key={`${h}-30`}
                    className="absolute inset-x-0 border-t border-border/10 border-dashed"
                    style={{
                      top: `${(h - CALENDAR_START_HOUR) * HOUR_PX + HOUR_PX / 2}px`,
                    }}
                  />
                ))}

                {/* Current-time indicator (today only) */}
                {isToday && <CurrentTimeMarker />}

                {/* Ticket blocks */}
                {layouted.map(({ ticket, leftFraction, widthFraction }) => (
                  <TicketBlock
                    key={ticket.key}
                    ticket={ticket}
                    leftFraction={leftFraction}
                    widthFraction={widthFraction}
                    isFrozen={!!frozen}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Current time indicator ───────────────────────────────────

function CurrentTimeMarker() {
  const [top, setTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    function update() {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const startMin = CALENDAR_START_HOUR * 60;
      const endMin = (CALENDAR_START_HOUR + DISPLAY_HOURS) * 60;
      if (minutes >= startMin && minutes <= endMin) {
        setTop(((minutes - startMin) * HOUR_PX) / 60);
      } else {
        setTop(null);
      }
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  if (top === null) return null;

  return (
    <div
      className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="h-2 w-2 rounded-full bg-error shrink-0 -ml-1" />
      <div className="flex-1 border-t-2 border-error" />
    </div>
  );
}
