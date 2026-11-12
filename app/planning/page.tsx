'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MousePointerClick, Plus } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components/layout';
import { CalendarGrid, TaskEditor, type TaskDraft } from '@/components/features';
import { Button, Segmented, Skeleton } from '@/components/ui';
import { addDaysISO, daysBetween, fmt, isoWeekday, todayISO, weekRange } from '@/lib/dates';
import { formatDuration } from '@/lib/planner';
import { updateTask, useMe, useRange } from '@/lib/client/data';
import { useUi } from '@/lib/store';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORIES, type Task } from '@/types';

export default function PlanningPage() {
  const { data: user } = useMe();
  const { planningView, setPlanningView } = useUi();
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Task | TaskDraft | null>(null);

  React.useEffect(() => setAnchor(todayISO()), []);
  const isMobile = useIsMobile();
  const view = isMobile ? 'day' : planningView;

  const { from, to } = React.useMemo(() => {
    if (!anchor) return { from: null, to: null };
    if (view === 'day') return { from: anchor, to: anchor };
    return weekRange(anchor);
  }, [anchor, view]);

  const { data, isLoading } = useRange(from, to);

  if (!user || !anchor || !from || !to) {
    return (
      <AppLayout wide>
        <Skeleton className="h-[70vh]" />
      </AppLayout>
    );
  }

  const settings = user.settings;
  const dates = daysBetween(from, to).filter(
    (d) => view !== 'workweek' || settings.workdays.includes(isoWeekday(d)),
  );
  const tasks = (data?.tasks ?? []).filter((t) => dates.includes(t.date));
  const validated = new Set((data?.days ?? []).filter((d) => d.validated).map((d) => d.date));
  const step = view === 'day' ? 1 : 7;
  const total = tasks.reduce((s, t) => s + t.durationMinutes, 0);
  const points = tasks.reduce((s, t) => s + t.points, 0);

  const title =
    view === 'day'
      ? fmt(anchor, 'EEEE d MMMM')
      : fmt(from, 'MMMM yyyy') === fmt(to, 'MMMM yyyy')
        ? `${fmt(from, 'd')} – ${fmt(to, 'd MMMM yyyy')}`
        : `${fmt(from, 'd MMM')} – ${fmt(to, 'd MMM yyyy')}`;

  return (
    <AppLayout wide>
      <PageHeader
        title="Planning"
        subtitle={
          <span className="capitalize">
            {title} · {formatDuration(total)} planifiées · {points} points
          </span>
        }
        actions={
          <>
            {!isMobile && (
              <Segmented
                size="sm"
                value={planningView}
                onChange={setPlanningView}
                options={[
                  { value: 'workweek', label: 'Ouvrés' },
                  { value: 'week', label: 'Semaine' },
                  { value: 'day', label: 'Jour' },
                ]}
              />
            )}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setAnchor(addDaysISO(anchor, -step))} aria-label="Précédent">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(todayISO())}>
                Aujourd&apos;hui
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setAnchor(addDaysISO(anchor, step))} aria-label="Suivant">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <Button size="sm" onClick={() => setEditing({ date: view === 'day' ? anchor : todayISO() })}>
              <Plus className="h-4 w-4" /> Tâche
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5" /> Glissez une carte pour la déplacer, tirez le bas pour changer sa durée, cliquez dans le vide pour créer.
        </span>
        <span className="flex flex-wrap gap-3">
          {CATEGORIES.filter((c) => tasks.some((t) => t.category === c)).map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
              {CATEGORY_LABELS[c]}
            </span>
          ))}
        </span>
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-[70vh]" />
      ) : (
        <CalendarGrid
          dates={dates}
          tasks={tasks}
          settings={settings}
          hourHeight={view === 'day' ? 72 : 60}
          validatedDates={validated}
          onSelect={setEditing}
          onMove={(t, date, start) => updateTask(t, { date, startTime: start, pinned: true }, settings)}
          onResize={(t, minutes) => updateTask(t, { manualDuration: minutes }, settings)}
          onCreateAt={(date, start) => setEditing({ date, startTime: start })}
        />
      )}

      <TaskEditor task={editing} user={user} onClose={() => setEditing(null)} />
    </AppLayout>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
