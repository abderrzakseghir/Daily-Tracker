'use client';

import * as React from 'react';
import { Navigation } from './navigation';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

export function AppLayout({ children, onLogout }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={onLogout} />

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen',
          // Mobile: top header + bottom nav padding
          'pt-14 pb-20',
          // Desktop: sidebar offset
          'lg:pl-64 lg:pt-0 lg:pb-0'
        )}
      >
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
