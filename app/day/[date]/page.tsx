'use client';

import { notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { DayView } from '@/components/features';

export default function DayPage({ params }: { params: { date: string } }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();
  return (
    <AppLayout wide>
      <DayView date={params.date} />
    </AppLayout>
  );
}
