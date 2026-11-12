'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Chart as ChartJS } from 'chart.js';
import { FileDown, FileSpreadsheet, Table2 } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components/layout';
import { Button, EmptyState, inputClass, Segmented, Skeleton } from '@/components/ui';
import { CategoryChart, HoursChart, WellbeingChart, type Bucket } from '@/components/features/report-charts';
import { cn } from '@/lib/utils';
import { addDaysISO, daysBetween, fmt, isoWeekday, monthRange, todayISO, weekRange } from '@/lib/dates';
import { formatDuration } from '@/lib/planner';
import { emptyByCategory, MOODS, summarizeDays, type DaySummary } from '@/lib/stats';
import { useMe, useRange } from '@/lib/client/data';
import { CATEGORIES, CATEGORY_LABELS, TASK_STATUS_LABELS, type Task } from '@/types';

type Preset = 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'quarter' | 'custom';

function presetRange(p: Preset, today: string): { from: string; to: string } {
  switch (p) {
    case 'week':
      return weekRange(today);
    case 'lastWeek':
      return weekRange(addDaysISO(today, -7));
    case 'month':
      return monthRange(today);
    case 'lastMonth':
      return monthRange(addDaysISO(monthRange(today).from, -1));
    case 'quarter':
      return { from: addDaysISO(today, -89), to: today };
    default:
      return weekRange(today);
  }
}

export default function ReportsPage() {
  const { data: user } = useMe();
  const [today, setToday] = React.useState<string | null>(null);
  const [preset, setPreset] = React.useState<Preset>('week');
  const [custom, setCustom] = React.useState<{ from: string; to: string } | null>(null);
  const [showTable, setShowTable] = React.useState(false);
  const hoursRef = React.useRef<ChartJS<'bar'>>(null);
  const categoryRef = React.useRef<ChartJS<'bar'>>(null);

  React.useEffect(() => {
    const t = todayISO();
    setToday(t);
    setCustom({ from: addDaysISO(t, -13), to: t });
  }, []);

  const range = today ? (preset === 'custom' && custom ? custom : presetRange(preset, today)) : null;
  const { data, isLoading } = useRange(range?.from ?? null, range?.to ?? null);

  const report = React.useMemo(() => {
    if (!range || !data || !user) return null;
    const dates = daysBetween(range.from, range.to);
    const days = summarizeDays(dates, data.days, data.tasks);
    const workdays = days.filter((d) => user.settings.workdays.includes(isoWeekday(d.date)) && d.date <= (today ?? ''));
    return { dates, days, workdays, buckets: toBuckets(days), tasks: data.tasks };
  }, [range?.from, range?.to, data, user, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !today || !range) {
    return (
      <AppLayout wide>
        <Skeleton className="h-[70vh]" />
      </AppLayout>
    );
  }

  const done = report?.tasks.filter((t) => t.status === 'done') ?? [];
  const doneMinutes = done.reduce((s, t) => s + t.durationMinutes, 0);
  const activeDays = report?.days.filter((d) => d.done > 0).length ?? 0;
  const validatedWorkdays = report?.workdays.filter((d) => d.validated).length ?? 0;
  const jiraMinutes = done.filter((t) => t.jiraKey).reduce((s, t) => s + t.durationMinutes, 0);
  const focusMinutes = report?.tasks.reduce((s, t) => s + t.actualMinutes, 0) ?? 0;
  const moods = report?.days.filter((d) => d.mood).map((d) => d.mood!) ?? [];
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const totals = emptyByCategory();
  done.forEach((t) => (totals[t.category] += t.durationMinutes));
  const completion = report?.tasks.length ? done.length / report.tasks.length : 0;
  const topJira = topJiraTickets(done);

  const periodLabel = `${fmt(range.from, 'd MMM yyyy')} → ${fmt(range.to, 'd MMM yyyy')}`;

  return (
    <AppLayout wide>
      <PageHeader
        title="Rapports"
        subtitle={periodLabel}
        actions={
          report && report.tasks.length > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={() => exportCsv(report.tasks, range)}>
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  exportPdf({
                    user: user.name,
                    periodLabel,
                    days: report.days.filter((d) => d.tasks > 0),
                    tasks: report.tasks,
                    kpis: [
                      ['Temps réalisé', formatDuration(doneMinutes)],
                      ['Tâches terminées', `${done.length}/${report.tasks.length}`],
                      ['Jours actifs', String(activeDays)],
                      ['Moyenne / jour actif', formatDuration(activeDays ? Math.round(doneMinutes / activeDays) : 0)],
                      ['Loggé sur Jira', formatDuration(jiraMinutes)],
                    ],
                    charts: [hoursRef.current?.toBase64Image(), categoryRef.current?.toBase64Image()],
                    range,
                  })
                }
              >
                <FileDown className="h-4 w-4" /> PDF
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          value={preset}
          onChange={setPreset}
          className="max-w-full overflow-x-auto no-scrollbar"
          options={[
            { value: 'week', label: 'Semaine' },
            { value: 'lastWeek', label: 'Sem. dernière' },
            { value: 'month', label: 'Mois' },
            { value: 'lastMonth', label: 'Mois dernier' },
            { value: 'quarter', label: '90 jours' },
            { value: 'custom', label: 'Personnalisé' },
          ]}
        />
        {preset === 'custom' && custom && (
          <div className="flex items-center gap-2">
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className={cn(inputClass, 'h-9 w-auto')} />
            <span className="text-muted">→</span>
            <input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className={cn(inputClass, 'h-9 w-auto')} />
          </div>
        )}
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : !report || report.tasks.length === 0 ? (
        <EmptyState icon="📊" title="Aucune donnée sur cette période" description="Ajoutez des tâches dans la vue Jour pour voir vos statistiques." />
      ) : (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Temps réalisé" value={formatDuration(doneMinutes)} sub={`${activeDays} jour(s) actif(s)`} />
            <Kpi label="Moyenne / jour actif" value={formatDuration(activeDays ? Math.round(doneMinutes / activeDays) : 0)} sub={`${done.reduce((s, t) => s + t.points, 0)} points réalisés`} />
            <Kpi label="Tâches terminées" value={`${Math.round(completion * 100)}%`} sub={`${done.length} sur ${report.tasks.length}`} />
            <Kpi label="Journées validées" value={`${validatedWorkdays}/${report.workdays.length}`} sub="jours ouvrés écoulés" />
            <Kpi label="Loggé sur Jira" value={formatDuration(jiraMinutes)} sub={doneMinutes ? `${Math.round((jiraMinutes / doneMinutes) * 100)}% du temps` : '—'} />
            <Kpi label="Temps de focus" value={formatDuration(focusMinutes)} sub="mesuré au minuteur" />
            <Kpi label="Humeur moyenne" value={avgMood ? `${MOODS[Math.round(avgMood) - 1].emoji} ${avgMood.toFixed(1)}` : '—'} sub={`${moods.length} jour(s) renseigné(s)`} />
            <Kpi label="Catégorie principale" value={topCategory(totals)} sub="par temps réalisé" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Temps réalisé par catégorie" subtitle={report.dates.length > 35 ? 'Par semaine' : 'Par jour'} className="lg:col-span-2">
              <div className="h-72">
                <HoursChart ref={hoursRef} buckets={report.buckets} />
              </div>
            </ChartCard>
            <ChartCard title="Répartition" subtitle="Heures réalisées par catégorie">
              <div className="h-72">
                <CategoryChart ref={categoryRef} totals={totals} />
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Humeur & énergie" subtitle="Échelle de 1 à 5" className="lg:col-span-2">
              {moods.length + report.days.filter((d) => d.energy).length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Renseignez votre humeur dans la vue Jour pour suivre son évolution.</p>
              ) : (
                <div className="h-64">
                  <WellbeingChart buckets={report.buckets} />
                </div>
              )}
            </ChartCard>
            <ChartCard title="Top tickets Jira" subtitle="Temps loggé sur la période">
              {topJira.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Aucun ticket Jira terminé sur la période.</p>
              ) : (
                <ul className="space-y-3">
                  {topJira.map((t) => (
                    <li key={t.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <a href={t.url ?? '#'} target="_blank" rel="noreferrer" className="truncate hover:underline">
                          <span className="font-semibold text-[#0052CC] dark:text-[#4C9AFF]">{t.key}</span>{' '}
                          <span className="text-muted">{t.title}</span>
                        </a>
                        <span className="shrink-0 font-medium tabular-nums">{formatDuration(t.minutes)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(t.minutes / topJira[0].minutes) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          {/* Vue tableau (accessibilité + détail) */}
          <div className="rounded-2xl border border-border bg-card">
            <button onClick={() => setShowTable((v) => !v)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="flex items-center gap-2 font-semibold">
                <Table2 className="h-4 w-4 text-accent" /> Détail par jour
              </span>
              <span className="text-sm text-muted">{showTable ? 'Masquer' : 'Afficher'}</span>
            </button>
            {showTable && (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Jour</th>
                      <th className="px-4 py-2 text-right font-medium">Tâches</th>
                      <th className="px-4 py-2 text-right font-medium">Réalisé</th>
                      <th className="px-4 py-2 text-right font-medium">Points</th>
                      {CATEGORIES.filter((c) => totals[c] > 0).map((c) => (
                        <th key={c} className="px-4 py-2 text-right font-medium">{CATEGORY_LABELS[c]}</th>
                      ))}
                      <th className="px-4 py-2 text-center font-medium">Validée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.filter((d) => d.tasks > 0).map((d) => (
                      <tr key={d.date} className="border-t border-border/60 hover:bg-surface/60">
                        <td className="px-4 py-2 capitalize">
                          <Link href={`/day/${d.date}`} className="hover:text-accent">{fmt(d.date, 'EEE d MMM')}</Link>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{d.done}/{d.tasks}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatDuration(d.doneMinutes)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{d.donePoints}</td>
                        {CATEGORIES.filter((c) => totals[c] > 0).map((c) => (
                          <td key={c} className="px-4 py-2 text-right tabular-nums text-muted">{d.byCategory[c] ? formatDuration(d.byCategory[c]) : '—'}</td>
                        ))}
                        <td className="px-4 py-2 text-center">{d.validated ? '✅' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ─── Agrégation ───────────────────────────────────────────────

function toBuckets(days: DaySummary[]): Bucket[] {
  // Seules les tâches terminées comptent dans le temps réalisé
  const doneByCategory = (d: DaySummary) => d.doneByCategory;

  if (days.length <= 35) {
    return days.map((d) => ({
      label: days.length <= 7 ? fmt(d.date, 'EEE d') : fmt(d.date, 'd/MM'),
      tooltipTitle: fmt(d.date, 'EEEE d MMMM'),
      byCategory: doneByCategory(d),
      mood: d.mood,
      energy: d.energy,
    }));
  }

  const weeks = new Map<string, DaySummary[]>();
  days.forEach((d) => {
    const w = weekRange(d.date).from;
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  });
  return Array.from(weeks, ([week, list]) => {
    const byCategory = emptyByCategory();
    list.forEach((d) => {
      const r = doneByCategory(d);
      CATEGORIES.forEach((c) => (byCategory[c] += r[c]));
    });
    const avg = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    return {
      label: `S${fmt(week, 'II')}`,
      tooltipTitle: `Semaine du ${fmt(week, 'd MMMM')}`,
      byCategory,
      mood: avg(list.map((d) => d.mood)),
      energy: avg(list.map((d) => d.energy)),
    };
  });
}

function topCategory(totals: Record<string, number>): string {
  const best = CATEGORIES.filter((c) => totals[c] > 0).sort((a, b) => totals[b] - totals[a])[0];
  return best ? CATEGORY_LABELS[best] : '—';
}

function topJiraTickets(done: Task[]) {
  const map = new Map<string, { key: string; title: string; url: string | null; minutes: number }>();
  done.forEach((t) => {
    if (!t.jiraKey) return;
    const cur = map.get(t.jiraKey) ?? { key: t.jiraKey, title: t.title.replace(`${t.jiraKey} · `, ''), url: t.jiraUrl, minutes: 0 };
    cur.minutes += t.durationMinutes;
    map.set(t.jiraKey, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 6);
}

// ─── Exports ──────────────────────────────────────────────────

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(tasks: Task[], range: { from: string; to: string }) {
  const header = ['Date', 'Tâche', 'Catégorie', 'Points', 'Statut', 'Début', 'Durée (min)', 'Focus (min)', 'Ticket Jira'];
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = tasks.map((t) =>
    [t.date, t.title, CATEGORY_LABELS[t.category], t.points, TASK_STATUS_LABELS[t.status], t.startTime, t.durationMinutes, t.actualMinutes, t.jiraKey].map(esc).join(';'),
  );
  const csv = '﻿' + [header.map(esc).join(';'), ...rows].join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `daily-tracker_${range.from}_${range.to}.csv`);
}

async function exportPdf(input: {
  user: string;
  periodLabel: string;
  days: DaySummary[];
  tasks: Task[];
  kpis: [string, string][];
  charts: (string | undefined)[];
  range: { from: string; to: string };
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold').setFontSize(20).text('Rapport d\'activité', 40, 56);
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(110).text(`${input.user} · ${input.periodLabel}`, 40, 76);
  doc.setTextColor(0);

  // KPI
  const kpiW = (W - 80) / input.kpis.length;
  input.kpis.forEach(([label, value], i) => {
    const x = 40 + i * kpiW;
    doc.setFontSize(8).setTextColor(120).text(label, x, 104);
    doc.setFontSize(14).setTextColor(0).setFont('helvetica', 'bold').text(value, x, 122);
    doc.setFont('helvetica', 'normal');
  });

  let y = 145;
  const [hours, categories] = input.charts;
  if (hours) {
    doc.addImage(hours, 'PNG', 40, y, W - 80, 200);
    y += 215;
  }
  if (categories) {
    doc.addImage(categories, 'PNG', 40, y, (W - 80) / 2, 150);
    y += 165;
  }

  autoTable(doc, {
    startY: y,
    head: [['Jour', 'Tâches', 'Réalisé', 'Points', 'Validée']],
    body: input.days.map((d) => [fmt(d.date, 'EEE d MMM'), `${d.done}/${d.tasks}`, formatDuration(d.doneMinutes), d.donePoints, d.validated ? 'Oui' : 'Non']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [42, 120, 214] },
  });

  autoTable(doc, {
    head: [['Date', 'Tâche', 'Catégorie', 'Pts', 'Durée', 'Jira']],
    body: input.tasks
      .filter((t) => t.status === 'done')
      .map((t) => [fmt(t.date, 'dd/MM'), t.title, CATEGORY_LABELS[t.category], t.points, formatDuration(t.durationMinutes), t.jiraKey ?? '']),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [42, 120, 214] },
    columnStyles: { 1: { cellWidth: 220 } },
  });

  doc.save(`rapport_${input.range.from}_${input.range.to}.pdf`);
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
