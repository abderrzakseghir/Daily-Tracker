'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { TicketPlanningPanel } from '@/components/features/ticket-planning-panel';
import { TimeblockingCalendar } from '@/components/features/timeblocking-calendar';
import { useStore } from '@/lib/store';
import { getWeekDays, autoScheduleTickets, toJiraStarted } from '@/lib/timeblocking';
import type { PlannedJiraTicket } from '@/types';

export default function TimeblockingPage() {
  const router = useRouter();

  // ── Auth guard ───────────────────────────────────────────────
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const _hasHydrated = useStore((s) => s._hasHydrated);

  React.useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/');
  }, [_hasHydrated, isAuthenticated, router]);

  // ── Store state ──────────────────────────────────────────────
  const user = useStore((s) => s.user);
  const plannedTickets = useStore((s) => s.plannedTickets);
  const frozenSchedules = useStore((s) => s.frozenSchedules);
  const updatePlannedTicket = useStore((s) => s.updatePlannedTicket);
  const freezeDaySchedule = useStore((s) => s.freezeDaySchedule);

  // ── Week navigation ──────────────────────────────────────────
  const [weekOffset, setWeekOffset] = React.useState(0);
  const weekDays = React.useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // ── Validate a day (local freeze, no Jira write) ─────────────
  function handleValidateDay(date: string) {
    const dayTickets = plannedTickets.filter(
      (t) => t.scheduledDate === date,
    );
    try {
      const scheduled = autoScheduleTickets(dayTickets);
      freezeDaySchedule(date, scheduled);
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  // ── Sync a frozen day to Jira worklogs ────────────────────────────
  async function handleSyncJira(date: string, tickets: PlannedJiraTicket[]) {
    if (!user?.jira) {
      alert('Connectez votre compte Jira dans les paramètres pour synchroniser.');
      return;
    }

    // ── BUG FIX: each ticket must carry its own `started` based on its
    //    scheduledStartTime, NOT a single shared "09:00" for the whole day.
    //    Without this, every worklog lands at 09:00 in Jira and they all
    //    overlap — only the first one is visible in Tempo.
    const payload = tickets.map((t) => {
      const startTime = t.scheduledStartTime ?? '09:00';
      const started = toJiraStarted(date, startTime);
      console.log(
        `[Jira sync] ${t.key} → started=${started} | ${t.computedDurationMinutes} min (${startTime})`,
      );
      return {
        key: t.key,
        durationMinutes: t.computedDurationMinutes,
        started,
      };
    });

    const res = await fetch('/api/jira/worklog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: user.jira.accessToken,
        cloudId: user.jira.cloudId,
        tickets: payload,
      }),
    });

    const json = await res.json().catch(() => ({})) as {
      synced?: number;
      failed?: number;
      details?: { key: string; reason: string }[];
      error?: string;
    };

    // 207 = partial failure (some tickets sent, some failed) — still need to warn.
    if (res.status === 207) {
      const detail = json.details?.map((d) => `• ${d.key}: ${d.reason}`).join('\n') ?? '';
      console.warn('[Jira sync] Partial failure:', json);
      throw new Error(
        `${json.failed} ticket(s) n'ont pas pu être envoyés (${json.synced} réussis).\n${detail}`,
      );
    }

    if (!res.ok) {
      throw new Error(json.error ?? 'Erreur lors de la synchronisation Jira');
    }

    console.log(`[Jira sync] ✓ ${json.synced} worklog(s) envoyés avec succès.`);
  }

  // ── Responsive panel state ───────────────────────────────────
  const [panelOpen, setPanelOpen] = React.useState(false);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
        {/* ── Left: ticket planning panel (collapsible on mobile) ─ */}
        <aside
          className={[
            'flex-shrink-0 border-r border-border bg-card flex flex-col transition-all duration-300',
            // Mobile: full-width overlay when open
            panelOpen
              ? 'fixed inset-0 z-30 w-full lg:relative lg:inset-auto lg:z-auto lg:w-80'
              : 'hidden lg:flex lg:w-80',
          ].join(' ')}
        >
          {/* Mobile close */}
          <div className="flex items-center justify-between p-3 border-b border-border lg:hidden">
            <span className="font-semibold text-sm">Tickets Jira</span>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-muted hover:text-foreground transition-colors text-sm"
            >
              Fermer ✕
            </button>
          </div>
          <TicketPlanningPanel weekDays={weekDays} />
        </aside>

        {/* Mobile overlay backdrop */}
        {panelOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* ── Right: calendar ── */}
        <main className="flex-1 flex flex-col min-w-0 p-4 gap-4 overflow-hidden">
          {/* Mobile toolbar */}
          <div className="flex items-center justify-between lg:hidden">
            <h1 className="font-bold text-lg">Timeblocking</h1>
            <button
              onClick={() => setPanelOpen(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted/10 transition-colors"
            >
              Tickets ({plannedTickets.filter((t) => t.scheduledDate !== null).length} planifiés)
            </button>
          </div>

          <TimeblockingCalendar
            weekDays={weekDays}
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            plannedTickets={plannedTickets}
            frozenSchedules={frozenSchedules}
            onValidateDay={handleValidateDay}
            onSyncJira={handleSyncJira}
          />
        </main>
      </div>
    </AppLayout>
  );
}
