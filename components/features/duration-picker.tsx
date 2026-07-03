'use client';

/**
 * DurationPicker — shared component for selecting a task duration.
 *
 * Features:
 *  - Preset options: 15 min, 30 min, 1h, 2h, 3h, 4h, Personnalisé
 *  - When "Personnalisé" is selected: numeric input + heures/minutes unit selector
 *  - Converts the custom input to minutes internally before calling onChange
 */

import * as React from 'react';
import { Duration, DURATIONS, DURATION_LABELS } from '@/types';
import { Select, SelectOption } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export interface DurationPickerProps {
  /** Currently selected duration preset. */
  value: Duration;
  /**
   * Current custom duration in minutes. Only relevant when value === 'custom'.
   * Pass undefined/0 when not yet set.
   */
  customMinutes?: number;
  onChange: (duration: Duration, customMinutes: number | undefined) => void;
  placeholder?: string;
}

const UNIT_OPTIONS: SelectOption[] = [
  { value: 'minutes', label: 'min' },
  { value: 'heures', label: 'h' },
];

export function DurationPicker({
  value,
  customMinutes,
  onChange,
  placeholder = 'Durée',
}: DurationPickerProps) {
  // Derive initial display value and unit from customMinutes
  const initUnit = React.useMemo<'minutes' | 'heures'>(() => {
    if (customMinutes && customMinutes >= 60 && customMinutes % 60 === 0) return 'heures';
    return 'minutes';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initDisplayValue = React.useMemo(() => {
    if (!customMinutes) return '';
    if (initUnit === 'heures') return String(customMinutes / 60);
    return String(customMinutes);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [rawInput, setRawInput] = React.useState(initDisplayValue);
  const [unit, setUnit] = React.useState<'minutes' | 'heures'>(initUnit);

  // Re-sync display when parent resets to non-custom (e.g. form reset)
  React.useEffect(() => {
    if (value !== 'custom') {
      setRawInput('');
      setUnit('minutes');
    }
  }, [value]);

  function toMinutes(raw: string, u: 'minutes' | 'heures'): number | undefined {
    const n = parseFloat(raw);
    if (!raw || isNaN(n) || n <= 0) return undefined;
    return u === 'heures' ? Math.round(n * 60) : Math.round(n);
  }

  function handleDurationChange(v: string) {
    const dur = v as Duration;
    onChange(dur, dur === 'custom' ? toMinutes(rawInput, unit) : undefined);
  }

  function handleRawInputChange(v: string) {
    setRawInput(v);
    onChange('custom', toMinutes(v, unit));
  }

  function handleUnitChange(v: string) {
    const newUnit = v as 'minutes' | 'heures';
    setUnit(newUnit);
    onChange('custom', toMinutes(rawInput, newUnit));
  }

  const durationOptions: SelectOption[] = DURATIONS.map((d) => ({
    value: d,
    label: DURATION_LABELS[d],
  }));

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <Select
          options={durationOptions}
          value={value}
          onChange={handleDurationChange}
          placeholder={placeholder}
        />
      </div>

      {value === 'custom' && (
        <>
          <div className="w-16 shrink-0">
            <Input
              type="number"
              placeholder="…"
              value={rawInput}
              onChange={(e) => handleRawInputChange(e.target.value)}
              min={1}
              step={unit === 'heures' ? 0.5 : 5}
            />
          </div>
          <div className="w-[4.5rem] shrink-0">
            <Select
              options={UNIT_OPTIONS}
              value={unit}
              onChange={handleUnitChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
