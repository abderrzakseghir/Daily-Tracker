'use client';

import * as React from 'react';
import { AlertOctagon, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateDayMeta } from '@/lib/client/data';
import { ENERGIES, MOODS } from '@/lib/stats';
import { inputClass } from '@/components/ui';
import type { DayMeta } from '@/types';

/** Humeur, énergie, bloquants et notes — sauvegarde automatique. */
export function DayJournal({ meta }: { meta: DayMeta }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <ScalePicker label="Humeur" options={MOODS} value={meta.mood} onChange={(mood) => updateDayMeta(meta.date, { mood })} />
      <ScalePicker label="Énergie" options={ENERGIES} value={meta.energy} onChange={(energy) => updateDayMeta(meta.date, { energy })} />
      <AutoSaveText
        key={`b-${meta.date}`}
        icon={<AlertOctagon className="h-4 w-4 text-error" />}
        label="Bloquants"
        placeholder="Qu'est-ce qui vous freine ? (partagé au daily)"
        initial={meta.blockers}
        onSave={(blockers) => updateDayMeta(meta.date, { blockers })}
      />
      <AutoSaveText
        key={`n-${meta.date}`}
        icon={<NotebookPen className="h-4 w-4 text-accent" />}
        label="Notes"
        placeholder="Décisions, apprentissages, à retenir…"
        initial={meta.notes}
        onSave={(notes) => updateDayMeta(meta.date, { notes })}
      />
    </div>
  );
}

function ScalePicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: number; emoji: string; label: string }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
            title={o.label}
            aria-label={o.label}
            className={cn(
              'flex h-10 flex-1 items-center justify-center rounded-xl text-xl transition',
              value === o.value ? 'scale-105 bg-accent/15 ring-2 ring-accent/40' : 'bg-surface grayscale-[60%] hover:grayscale-0',
            )}
          >
            {o.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function AutoSaveText({
  icon,
  label,
  placeholder,
  initial,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  initial: string;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [state, setState] = React.useState<'idle' | 'pending' | 'saved'>('idle');
  const saved = React.useRef(initial);
  const save = React.useRef(onSave);
  save.current = onSave;
  const latest = React.useRef(value);
  latest.current = value;

  React.useEffect(() => {
    if (value === saved.current) return;
    setState('pending');
    const id = setTimeout(() => {
      saved.current = value;
      save.current(value);
      setState('saved');
    }, 800);
    return () => clearTimeout(id);
  }, [value]);

  // Sauvegarde immédiate si on quitte la page avec une saisie en attente
  React.useEffect(
    () => () => {
      if (latest.current !== saved.current) save.current(latest.current);
    },
    [],
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {icon} {label}
        </p>
        <span className="text-[10px] text-muted">{state === 'pending' ? 'Enregistrement…' : state === 'saved' ? 'Enregistré ✓' : ''}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={cn(inputClass, 'h-auto resize-y py-2 leading-relaxed')}
      />
    </div>
  );
}
