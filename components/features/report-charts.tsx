'use client';

import * as React from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { useTheme } from 'next-themes';
import { formatDuration } from '@/lib/planner';
import { ENERGIES, MOODS } from '@/lib/stats';
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_COLORS_DARK,
  CATEGORY_LABELS,
  type Category,
} from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

export interface Bucket {
  label: string;
  tooltipTitle: string;
  byCategory: Record<Category, number>;
  mood: number | null;
  energy: number | null;
}

/** Couleurs du thème courant pour les graphiques (chaque mode a ses propres teintes). */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return {
    dark,
    categories: dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS,
    surface: dark ? '#14161c' : '#ffffff',
    text: dark ? '#c3c6cf' : '#52514e',
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,17,21,0.06)',
    series1: dark ? '#3987e5' : '#2a78d6',
    series2: dark ? '#d95926' : '#eb6834',
  };
}

function baseOptions(theme: ReturnType<typeof useChartTheme>): ChartOptions<'bar' | 'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: theme.text, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, padding: 14, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: theme.dark ? '#1b1e26' : '#ffffff',
        titleColor: theme.dark ? '#f4f5f7' : '#0f1115',
        bodyColor: theme.text,
        borderColor: theme.grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
        usePointStyle: true,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } }, border: { display: false } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 } }, border: { display: false } },
    },
  };
}

/** Heures réalisées par jour (ou semaine), empilées par catégorie. */
export const HoursChart = React.forwardRef<ChartJS<'bar'>, { buckets: Bucket[] }>(function HoursChart({ buckets }, ref) {
  const theme = useChartTheme();
  const used = CATEGORIES.filter((c) => buckets.some((b) => b.byCategory[c] > 0));
  const base = baseOptions(theme) as ChartOptions<'bar'>;
  const options: ChartOptions<'bar'> = {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins!.tooltip,
        // Le filtre peut retirer toutes les entrées (jour sans temps réalisé) :
        // les callbacks doivent accepter une liste vide.
        filter: (item) => (item.raw as number) > 0,
        callbacks: {
          title: (items) => (items.length ? buckets[items[0].dataIndex]?.tooltipTitle ?? '' : ''),
          label: (item) => ` ${item.dataset.label} : ${formatDuration(Math.round((item.raw as number) * 60))}`,
          footer: (items) =>
            items.length
              ? `Total : ${formatDuration(Math.round(items.reduce((s, i) => s + (i.raw as number), 0) * 60))}`
              : '',
        },
      },
    },
    scales: {
      x: { ...base.scales!.x, stacked: true },
      y: { ...base.scales!.y, stacked: true, ticks: { ...base.scales!.y!.ticks, callback: (v) => `${v}h` } },
    },
  };
  return (
    <Bar
      ref={ref as any}
      options={options}
      data={{
        labels: buckets.map((b) => b.label),
        datasets: used.map((c) => ({
          label: CATEGORY_LABELS[c],
          data: buckets.map((b) => Math.round((b.byCategory[c] / 60) * 100) / 100),
          backgroundColor: theme.categories[c],
          borderColor: theme.surface,
          borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
          borderRadius: 4,
          borderSkipped: 'bottom',
          maxBarThickness: 36,
        })),
      }}
    />
  );
});

/** Répartition du temps par catégorie — barres horizontales triées. */
export const CategoryChart = React.forwardRef<ChartJS<'bar'>, { totals: Record<Category, number> }>(function CategoryChart({ totals }, ref) {
  const theme = useChartTheme();
  const entries = CATEGORIES.filter((c) => totals[c] > 0).sort((a, b) => totals[b] - totals[a]);
  const sum = entries.reduce((s, c) => s + totals[c], 0);
  const base = baseOptions(theme) as ChartOptions<'bar'>;
  const options: ChartOptions<'bar'> = {
    ...base,
    indexAxis: 'y',
    interaction: { mode: 'nearest', intersect: true, axis: 'y' },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins!.tooltip,
        callbacks: {
          label: (item) => {
            const min = Math.round((item.raw as number) * 60);
            return ` ${formatDuration(min)} · ${Math.round((min / Math.max(1, sum)) * 100)}%`;
          },
        },
      },
    },
    scales: {
      x: { ...base.scales!.x, grid: { color: theme.grid }, ticks: { ...base.scales!.x!.ticks, callback: (v) => `${v}h` } },
      y: { ...base.scales!.y, grid: { display: false } },
    },
  };
  return (
    <Bar
      ref={ref as any}
      options={options}
      data={{
        labels: entries.map((c) => CATEGORY_LABELS[c]),
        datasets: [
          {
            label: 'Heures',
            data: entries.map((c) => Math.round((totals[c] / 60) * 100) / 100),
            backgroundColor: entries.map((c) => theme.categories[c]),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 22,
          },
        ],
      }}
    />
  );
});

/** Humeur et énergie (même échelle 1–5, un seul axe). */
export const WellbeingChart = React.forwardRef<ChartJS<'line'>, { buckets: Bucket[] }>(function WellbeingChart({ buckets }, ref) {
  const theme = useChartTheme();
  const base = baseOptions(theme) as ChartOptions<'line'>;
  const labelFor = (list: typeof MOODS, v: number) => list.find((m) => m.value === Math.round(v));
  const options: ChartOptions<'line'> = {
    ...base,
    spanGaps: true,
    plugins: {
      ...base.plugins,
      tooltip: {
        ...base.plugins!.tooltip,
        // Jours sans humeur/énergie saisie : valeurs null, à ne pas afficher.
        filter: (item) => typeof item.raw === 'number',
        callbacks: {
          title: (items) => (items.length ? buckets[items[0].dataIndex]?.tooltipTitle ?? '' : ''),
          label: (item) => {
            const v = item.raw as number;
            const l = labelFor(item.datasetIndex === 0 ? MOODS : ENERGIES, v);
            return ` ${item.dataset.label} : ${l?.emoji ?? ''} ${l?.label ?? ''} (${v.toFixed(1)})`;
          },
        },
      },
    },
    scales: {
      x: base.scales!.x,
      y: {
        type: 'linear',
        min: 1,
        max: 5,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.text, stepSize: 1, callback: (v) => MOODS.find((m) => m.value === v)?.emoji ?? '' },
      },
    },
  };
  const line = (color: string) => ({
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBorderColor: theme.surface,
    pointBorderWidth: 2,
    tension: 0.3,
  });
  return (
    <Line
      ref={ref as any}
      options={options}
      data={{
        labels: buckets.map((b) => b.label),
        datasets: [
          { label: 'Humeur', data: buckets.map((b) => b.mood), ...line(theme.series1) },
          { label: 'Énergie', data: buckets.map((b) => b.energy), ...line(theme.series2) },
        ],
      }}
    />
  );
});
