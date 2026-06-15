'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout';
import { DailyMeetingView } from '@/components/features';
import { format, subDays } from 'date-fns';

export default function DailyMeetingPage() {
  const router = useRouter();
  const { isAuthenticated, entries, logout } = useStore();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const todayEntry = entries.find((e) => e.date === today);
  const yesterdayEntry = entries.find((e) => e.date === yesterday);

  return (
    <AppLayout onLogout={logout}>
      <div className="max-w-2xl mx-auto">
        <DailyMeetingView
          todayEntry={todayEntry}
          yesterdayEntry={yesterdayEntry}
        />
      </div>
    </AppLayout>
  );
}
