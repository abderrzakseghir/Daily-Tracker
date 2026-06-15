'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DailyEntry, CATEGORY_LABELS, ReportPeriod } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';
import { calculateTotalMinutes, calculateCategoryBreakdown } from '@/lib/calculations';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from 'date-fns';

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, entries, user, logout } = useStore();
  const [reportType, setReportType] = React.useState<ReportPeriod>('weekly');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [reportTitle, setReportTitle] = React.useState('');

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const reportOptions: SelectOption[] = [
    { value: 'daily', label: 'Rapport journalier' },
    { value: 'weekly', label: 'Rapport hebdomadaire' },
    { value: 'monthly', label: 'Rapport mensuel' },
    { value: 'custom', label: 'Période personnalisée' },
  ];

  const getDateRange = (): { start: Date; end: Date } => {
    const today = new Date();

    switch (reportType) {
      case 'daily':
        return { start: today, end: today };
      case 'weekly':
        return {
          start: startOfWeek(today, { weekStartsOn: 1 }),
          end: endOfWeek(today, { weekStartsOn: 1 }),
        };
      case 'monthly':
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
        };
      case 'custom':
        return {
          start: customStart ? new Date(customStart) : subDays(today, 30),
          end: customEnd ? new Date(customEnd) : today,
        };
    }
  };

  const { start, end } = getDateRange();

  const filteredEntries = entries.filter((entry) => {
    const entryDate = new Date(entry.date);
    return isWithinInterval(entryDate, { start, end });
  });

  const totalTasks = filteredEntries.reduce(
    (sum, e) => sum + e.tasks.length,
    0
  );

  const totalMinutes = filteredEntries.reduce(
    (sum, e) => sum + calculateTotalMinutes(e.tasks),
    0
  );

  const validatedDays = filteredEntries.filter((e) => e.validated).length;

  const handleGeneratePDF = async () => {
    setIsGenerating(true);

    // Dynamic import of jsPDF
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text(reportTitle || 'Rapport Daily Tracker', 20, 20);

    // Subtitle
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(
      `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
      20,
      30
    );
    doc.text(`Généré par ${user?.name || 'Utilisateur'}`, 20, 37);

    // Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Résumé', 20, 50);

    doc.setFontSize(10);
    doc.text(`Tâches réalisées: ${totalTasks}`, 20, 60);
    doc.text(`Temps total: ${formatTime(totalMinutes)}`, 20, 67);
    doc.text(`Jours validés: ${validatedDays}`, 20, 74);

    // Tasks table
    const tableData: string[][] = [];

    filteredEntries.forEach((entry) => {
      entry.tasks.forEach((task) => {
        tableData.push([
          formatDate(entry.date, 'short'),
          CATEGORY_LABELS[task.category],
          task.description,
          task.duration === 'custom'
            ? `${task.customDuration} min`
            : task.duration,
        ]);
      });
    });

    if (tableData.length > 0) {
      autoTable(doc, {
        startY: 85,
        head: [['Date', 'Catégorie', 'Tâche', 'Durée']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });
    }

    // Save
    const filename = `rapport-${format(start, 'yyyy-MM-dd')}-${format(end, 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);

    setIsGenerating(false);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Rapports</h1>
          <p className="text-muted">
            Générez des rapports PDF pour vos réunions et bilans
          </p>
        </div>

        {/* Config */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-accent" />
              Configuration du rapport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Type de rapport"
                options={reportOptions}
                value={reportType}
                onChange={(v) => setReportType(v as ReportPeriod)}
              />

              <Input
                label="Titre personnalisé (optionnel)"
                placeholder="Mon rapport mensuel"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </div>

            {reportType === 'custom' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Date de début"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <Input
                  label="Date de fin"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="text-base">Aperçu du rapport</CardTitle>
            <CardDescription>
              {formatDate(start, 'short')} - {formatDate(end, 'short')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/10 p-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <div>
                  <p className="text-2xl font-bold">{totalTasks}</p>
                  <p className="text-xs text-muted">Tâches</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/10 p-4">
                <Clock className="h-6 w-6 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{formatTime(totalMinutes)}</p>
                  <p className="text-xs text-muted">Temps</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/10 p-4">
                <Calendar className="h-6 w-6 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{validatedDays}</p>
                  <p className="text-xs text-muted">Jours</p>
                </div>
              </div>
            </div>

            {/* Entries preview */}
            {filteredEntries.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/10">
                    <tr>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Tâches</th>
                      <th className="text-left p-3 font-medium">Temps</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.slice(0, 5).map((entry) => (
                      <tr key={entry.id} className="border-t border-border">
                        <td className="p-3">{formatDate(entry.date, 'short')}</td>
                        <td className="p-3">{entry.tasks.length}</td>
                        <td className="p-3">
                          {formatTime(calculateTotalMinutes(entry.tasks))}
                        </td>
                        <td className="p-3">
                          {entry.validated ? (
                            <Badge variant="success">Validé</Badge>
                          ) : (
                            <Badge variant="secondary">En cours</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredEntries.length > 5 && (
                  <p className="text-center text-sm text-muted p-3 border-t border-border">
                    + {filteredEntries.length - 5} autres entrées
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune entrée pour cette période</p>
              </div>
            )}

            {/* Generate button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleGeneratePDF}
              disabled={filteredEntries.length === 0 || isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              {isGenerating ? 'Génération...' : 'Télécharger le PDF'}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Reports */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto p-4 flex-col items-start"
            onClick={() => setReportType('daily')}
          >
            <span className="font-medium">Rapport journalier</span>
            <span className="text-xs text-muted">Aujourd'hui</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto p-4 flex-col items-start"
            onClick={() => setReportType('weekly')}
          >
            <span className="font-medium">Rapport hebdomadaire</span>
            <span className="text-xs text-muted">Cette semaine</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto p-4 flex-col items-start"
            onClick={() => setReportType('monthly')}
          >
            <span className="font-medium">Rapport mensuel</span>
            <span className="text-xs text-muted">Ce mois</span>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
