'use client';

import * as React from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { api } from '@/lib/client/api';
import { revalidateRanges } from '@/lib/client/data';
import { toast, useUi } from '@/lib/store';

const LEGACY_KEY = 'daily-tracker-storage';

/** Propose d'importer les journées de l'ancienne version (stockées dans le navigateur). */
export function LegacyImportBanner() {
  const { legacyImportDismissed, dismissLegacyImport } = useUi();
  const [entries, setEntries] = React.useState<unknown[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      const list = raw ? JSON.parse(raw)?.state?.entries : null;
      if (Array.isArray(list) && list.some((e) => e?.tasks?.length || e?.plannedTasks?.length)) setEntries(list);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  if (legacyImportDismissed || !entries) return null;

  const runImport = async () => {
    setLoading(true);
    try {
      const res = await api<{ importedDays: number; importedTasks: number }>('/api/import', {
        method: 'POST',
        json: { entries },
      });
      toast(`${res.importedTasks} tâche(s) importée(s) sur ${res.importedDays} journée(s)`, 'success');
      dismissLegacyImport();
      revalidateRanges();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import impossible', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <DownloadCloud className="h-5 w-5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Données de l&apos;ancienne version détectées</span>
        <span className="text-muted"> — {entries.length} journée(s) enregistrées dans ce navigateur. Importez-les dans votre compte pour les retrouver partout.</span>
      </p>
      <Button size="sm" onClick={runImport} isLoading={loading}>Importer</Button>
      <button onClick={dismissLegacyImport} className="rounded-lg p-1 text-muted hover:text-foreground" aria-label="Ignorer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
