'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Points (1–10) ────────────────────────────────────────────

export function pointsColor(points: number): string {
  if (points >= 9) return '#EF4444';
  if (points >= 7) return '#F59E0B';
  if (points >= 4) return '#6366F1';
  return '#10B981';
}

export function pointsLabel(points: number): string {
  if (points >= 9) return 'Critique';
  if (points >= 7) return 'Important';
  if (points >= 4) return 'Normal';
  return 'Léger';
}

interface PointsPickerProps {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}

/** Sélecteur de points 1–10 : pastilles cliquables (tactile) avec couleur d'intensité. */
export function PointsPicker({ value, onChange, compact }: PointsPickerProps) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Points">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => {
        const active = p <= value;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === value}
            aria-label={`${p} point${p > 1 ? 's' : ''}`}
            onClick={() => onChange(p)}
            className={cn(
              'relative flex items-center justify-center rounded-lg text-xs font-semibold transition-all',
              compact ? 'h-7 w-6' : 'h-9 flex-1 min-w-[26px]',
              active ? 'text-white' : 'bg-surface text-muted hover:bg-border',
            )}
            style={active ? { backgroundColor: pointsColor(value), opacity: 0.45 + (p / value) * 0.55 } : undefined}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export function PointsBadge({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums', className)}
      style={{ backgroundColor: `${pointsColor(points)}1f`, color: pointsColor(points) }}
      title={`${points}/10 · ${pointsLabel(points)}`}
    >
      {points}
      <span className="font-medium opacity-60">/10</span>
    </span>
  );
}

// ─── Switch ───────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = React.useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-50')}>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cn('h-5 w-5 rounded-full bg-white shadow', checked ? 'ml-[22px]' : 'ml-0.5')}
        />
      </button>
    </div>
  );
}

// ─── Contrôle segmenté ────────────────────────────────────────

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: SegmentedProps<T>) {
  const id = React.useId();
  return (
    <div className={cn('inline-flex rounded-xl bg-surface p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'relative rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'text-foreground' : 'text-muted hover:text-foreground',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-lg bg-card shadow-soft"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Divers ───────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-3xl">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  'h-10 w-full rounded-xl border border-border bg-card px-3 text-sm transition placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
