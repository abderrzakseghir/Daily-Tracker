'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, GripVertical, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt, nowMinutes, todayISO } from '@/lib/dates';
import { formatDuration, fromMinutes, planDay, toMinutes, type Segment } from '@/lib/planner';
import { CATEGORY_COLORS, type Task, type UserSettings } from '@/types';
import { PointsBadge } from '@/components/ui';

const SNAP = 15;

interface CalendarGridProps {
  dates: string[];
  tasks: Task[];
  settings: UserSettings;
  hourHeight?: number;
  showHeader?: boolean;
  onSelect: (task: Task) => void;
  onMove: (task: Task, date: string, startTime: string) => void;
  onResize: (task: Task, minutes: number) => void;
  onCreateAt?: (date: string, startTime: string) => void;
  validatedDates?: Set<string>;
}

interface DragState {
  task: Task;
  mode: 'move' | 'resize';
  pointerId: number;
  originX: number;
  originY: number;
  /** Décalage (minutes) entre le haut de la carte et le point saisi. */
  grabOffset: number;
  columns: { date: string; left: number; right: number; top: number }[];
  moved: boolean;
  previewDate: string;
  previewStart: number;
  previewDuration: number;
}

export function CalendarGrid({
  dates,
  tasks,
  settings,
  hourHeight = 64,
  showHeader = true,
  onSelect,
  onMove,
  onResize,
  onCreateAt,
  validatedDates,
}: CalendarGridProps) {
  const today = todayISO();
  const columnsRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const [now, setNow] = React.useState(nowMinutes());

  React.useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Plan de chaque journée ──
  const plans = React.useMemo(() => {
    const map = new Map<string, Map<string, { segments: Segment[]; overflow: boolean }>>();
    for (const date of dates) {
      map.set(date, planDay(tasks.filter((t) => t.date === date), settings));
    }
    return map;
  }, [dates, tasks, settings]);

  // ── Plage horaire affichée ──
  const { startMin, endMin } = React.useMemo(() => {
    let lo = toMinutes(settings.workdayStart);
    let hi = toMinutes(settings.workdayEnd);
    plans.forEach((plan) =>
      plan.forEach((slot) =>
        slot.segments.forEach((s) => {
          lo = Math.min(lo, s.start);
          hi = Math.max(hi, s.end);
        }),
      ),
    );
    return {
      startMin: Math.max(0, Math.floor(lo / 60) * 60 - 60),
      endMin: Math.min(24 * 60, Math.ceil(hi / 60) * 60 + 60),
    };
  }, [plans, settings]);

  const pxPerMin = hourHeight / 60;
  const totalHeight = (endMin - startMin) * pxPerMin;
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60);
  const workStart = toMinutes(settings.workdayStart);
  const workEnd = toMinutes(settings.workdayEnd);
  const lunch = settings.lunchEnabled
    ? { start: toMinutes(settings.lunchStart), end: toMinutes(settings.lunchEnd) }
    : null;

  const yToMinutes = (y: number) => startMin + y / pxPerMin;
  const snap = (m: number) => Math.round(m / SNAP) * SNAP;

  // ── Glisser-déposer ──
  const beginDrag = (e: React.PointerEvent, task: Task, mode: DragState['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const cols = Array.from(columnsRef.current?.querySelectorAll<HTMLElement>('[data-date]') ?? []).map((el) => {
      const r = el.getBoundingClientRect();
      return { date: el.dataset.date!, left: r.left, right: r.right, top: r.top };
    });
    const col = cols.find((c) => c.date === task.date);
    const slot = plans.get(task.date)?.get(task.id);
    const start = slot?.segments[0]?.start ?? toMinutes(task.startTime ?? settings.workdayStart);
    const pointerMin = col ? yToMinutes(e.clientY - col.top) : start;
    const state: DragState = {
      task,
      mode,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      grabOffset: pointerMin - start,
      columns: cols,
      moved: false,
      previewDate: task.date,
      previewStart: start,
      previewDuration: task.durationMinutes,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = state;
    setDrag(state);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dist = Math.hypot(e.clientX - d.originX, e.clientY - d.originY);
    if (!d.moved && dist < 5) return;

    const col =
      d.columns.find((c) => e.clientX >= c.left && e.clientX <= c.right) ??
      d.columns.find((c) => c.date === d.previewDate)!;
    const pointerMin = yToMinutes(e.clientY - col.top);
    let next: DragState;
    if (d.mode === 'move') {
      const start = Math.max(0, Math.min(24 * 60 - SNAP, snap(pointerMin - d.grabOffset)));
      next = { ...d, moved: true, previewDate: col.date, previewStart: start };
    } else {
      const duration = Math.max(SNAP, snap(pointerMin - d.previewStart));
      next = { ...d, moved: true, previewDuration: duration };
    }
    dragRef.current = next;
    setDrag(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.moved) {
      if (d.mode === 'move') onSelect(d.task);
      return;
    }
    if (d.mode === 'move') onMove(d.task, d.previewDate, fromMinutes(d.previewStart));
    else if (d.previewDuration !== d.task.durationMinutes) onResize(d.task, d.previewDuration);
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!onCreateAt || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const m = Math.floor(yToMinutes(e.clientY - rect.top) / 30) * 30;
    onCreateAt(date, fromMinutes(m));
  };

  const gridTemplate = { gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {showHeader && (
        <div className="flex border-b border-border">
          <div className="w-12 shrink-0 sm:w-14" />
          <div className="grid flex-1" style={gridTemplate}>
            {dates.map((date) => {
              const dayTasks = tasks.filter((t) => t.date === date);
              const total = dayTasks.reduce((s, t) => s + t.durationMinutes, 0);
              const isToday = date === today;
              return (
                <div key={date} className="border-l border-border px-1 py-2 text-center first:border-l-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{fmt(date, 'EEE')}</p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold',
                      isToday && 'bg-accent text-white',
                    )}
                  >
                    {fmt(date, 'd')}
                  </p>
                  <p className="mt-0.5 h-4 text-[11px] text-muted">
                    {validatedDates?.has(date) ? '✅ ' : ''}
                    {total > 0 ? formatDuration(total) : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative flex" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {/* Graduations horaires */}
        <div className="relative w-12 shrink-0 sm:w-14" style={{ height: totalHeight }}>
          {hours.slice(0, -1).map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ top: (h - startMin) * pxPerMin }}
            >
              {h > startMin ? fromMinutes(h) : ''}
            </span>
          ))}
        </div>

        <div ref={columnsRef} className="relative grid flex-1" style={{ ...gridTemplate, height: totalHeight }}>
          {/* Lignes horaires */}
          <div className="pointer-events-none absolute inset-0">
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: (h - startMin) * pxPerMin }} />
            ))}
          </div>

          {dates.map((date) => {
            const plan = plans.get(date)!;
            const dayTasks = tasks.filter((t) => t.date === date);
            return (
              <div
                key={date}
                data-date={date}
                className={cn('relative border-l border-border first:border-l-0', onCreateAt && 'cursor-copy')}
                onClick={(e) => handleGridClick(e, date)}
              >
                {/* Hors heures de travail */}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-surface/60" style={{ height: Math.max(0, (workStart - startMin) * pxPerMin) }} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface/60" style={{ top: (workEnd - startMin) * pxPerMin }} />
                {lunch && (
                  <div
                    className="stripes pointer-events-none absolute inset-x-0 flex items-center justify-center"
                    style={{ top: (lunch.start - startMin) * pxPerMin, height: (lunch.end - lunch.start) * pxPerMin }}
                  >
                    <span className="rounded bg-card/80 px-1.5 text-[10px] font-medium text-muted">🍽 Pause</span>
                  </div>
                )}

                {/* Ligne "maintenant" */}
                {date === today && now >= startMin && now <= endMin && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (now - startMin) * pxPerMin }}>
                    <div className="relative h-0.5 bg-error">
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-error" />
                    </div>
                  </div>
                )}

                {/* Cartes */}
                {dayTasks.map((task) => {
                  const slot = plan.get(task.id);
                  if (!slot) return null;
                  const isDragged = drag?.task.id === task.id && drag.moved;
                  return slot.segments.map((seg, i) => (
                    <TaskBlock
                      key={`${task.id}-${i}`}
                      task={task}
                      segment={seg}
                      isFirst={i === 0}
                      isLast={i === slot.segments.length - 1}
                      overflow={slot.overflow}
                      top={(seg.start - startMin) * pxPerMin}
                      height={(seg.end - seg.start) * pxPerMin}
                      dimmed={isDragged}
                      onPointerDown={(e, mode) => beginDrag(e, task, mode)}
                      onOpen={() => onSelect(task)}
                    />
                  ));
                })}

                {/* Aperçu pendant le glisser */}
                {drag?.moved && drag.previewDate === date && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded-xl border-2 border-dashed border-accent bg-accent/10 px-2 py-1"
                    style={{
                      top: (drag.previewStart - startMin) * pxPerMin,
                      height: Math.max(20, drag.previewDuration * pxPerMin),
                    }}
                  >
                    <p className="text-[11px] font-semibold text-accent">
                      {fromMinutes(drag.previewStart)} – {fromMinutes(drag.previewStart + drag.previewDuration)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
  segment: Segment;
  isFirst: boolean;
  isLast: boolean;
  overflow: boolean;
  top: number;
  height: number;
  dimmed: boolean;
  onPointerDown: (e: React.PointerEvent, mode: 'move' | 'resize') => void;
  onOpen: () => void;
}

function TaskBlock({ task, segment, isFirst, isLast, overflow, top, height, dimmed, onPointerDown, onOpen }: TaskBlockProps) {
  const pointerType = React.useRef('mouse');
  const color = CATEGORY_COLORS[task.category];
  const done = task.status === 'done';
  const compact = height < 44;

  return (
    <motion.div
      layout="position"
      initial={false}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className={cn(
        'group absolute inset-x-1 z-10 select-none overflow-hidden rounded-xl border text-left shadow-sm transition-[opacity,box-shadow] hover:z-20 hover:shadow-card',
        'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-30',
        overflow && 'ring-2 ring-error/60',
      )}
      style={{
        top: top + 1,
        height: Math.max(18, height - 2),
        backgroundColor: `color-mix(in srgb, ${color} ${done ? 8 : 14}%, var(--card))`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        touchAction: 'manipulation',
      }}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType;
        // Souris/stylet : glisser depuis toute la carte. Tactile : le défilement reste libre.
        if (e.pointerType !== 'touch') onPointerDown(e, 'move');
      }}
      onClick={() => {
        if (pointerType.current === 'touch') onOpen();
      }}
      title={`${task.title} · ${fromMinutes(segment.start)}–${fromMinutes(segment.end)}`}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
      <div className={cn('flex h-full flex-col pl-2.5 pr-1.5', compact ? 'justify-center py-0' : 'py-1.5')}>
        <div className="flex items-start gap-1">
          {done && <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />}
          {task.pinned && isFirst && <Pin className="mt-0.5 h-3 w-3 shrink-0 text-muted" />}
          <p className={cn('flex-1 truncate text-xs font-semibold leading-tight', done && 'text-muted line-through')}>
            {!isFirst && '↳ '}
            {task.title}
          </p>
          <span
            className="-mr-1 shrink-0 cursor-grab rounded p-0.5 text-muted opacity-60 sm:hidden"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              pointerType.current = 'handle';
              onPointerDown(e, 'move');
            }}
            aria-label="Déplacer"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted">
            <span className="tabular-nums">
              {fromMinutes(segment.start)}–{fromMinutes(segment.end)}
            </span>
            {isFirst && height > 60 && <PointsBadge points={task.points} className="px-1 py-0 text-[10px]" />}
            {task.jiraKey && height > 60 && (
              <span className="rounded bg-[#0052CC]/10 px-1 font-medium text-[#0052CC] dark:text-[#4C9AFF]">{task.jiraKey}</span>
            )}
          </div>
        )}
      </div>
      {isLast && (
        <div
          className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize opacity-0 transition group-hover:opacity-100 max-sm:opacity-100"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            pointerType.current = 'handle';
            onPointerDown(e, 'resize');
          }}
        >
          <div className="mx-auto mt-1 h-1 w-6 rounded-full bg-foreground/30" />
        </div>
      )}
    </motion.div>
  );
}
