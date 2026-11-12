'use client';

import * as React from 'react';
import { AppLayout } from '@/components/layout';
import { DayView } from '@/components/features';
import { LegacyImportBanner } from '@/components/features/legacy-import-banner';
import { todayISO } from '@/lib/dates';

export default function DashboardPage() {
  // La date du jour est calculée côté client (fuseau de l'utilisateur).
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => {
    setToday(todayISO());
    // Passage à minuit : on suit le nouveau jour
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <AppLayout wide>
      <LegacyImportBanner />
      {today && <DayView date={today} />}
    </AppLayout>
  );
}
