'use client';

import { ThemeProvider } from 'next-themes';
import { ReactNode, useEffect } from 'react';
import { SWRConfig } from 'swr';
import { swrCache, SWRBridge } from '@/lib/client/data';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SWRConfig
        value={{
          provider: () => swrCache,
          revalidateOnFocus: true,
          shouldRetryOnError: (err) => (err as { status?: number })?.status !== 401,
          errorRetryCount: 2,
        }}
      >
        <SWRBridge />
        {children}
        <Toaster />
      </SWRConfig>
    </ThemeProvider>
  );
}
