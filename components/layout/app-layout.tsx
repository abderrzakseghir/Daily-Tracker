'use client';

import * as React from 'react';
import { Navigation } from './navigation';
import { FocusTimer } from '@/components/features/focus-timer';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  /** Largeur max du contenu (le planning a besoin de toute la largeur). */
  wide?: boolean;
}

export function AppLayout({ children, wide }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="min-h-screen pb-24 pt-14 lg:pb-10 lg:pl-64 lg:pt-0">
        <div className={cn('mx-auto px-4 py-5 lg:px-8 lg:py-8', wide ? 'max-w-[1400px]' : 'max-w-5xl')}>
          {children}
        </div>
      </main>
      <FocusTimer />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
