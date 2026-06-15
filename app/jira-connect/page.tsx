'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

/**
 * Intermediate page for Jira OAuth callback.
 * No auth guard — claims the httpOnly cookie set by the callback route
 * and stores the connection in Zustand before redirecting to Settings.
 */
export default function JiraConnectPage() {
  const router = useRouter();
  const connectJira = useStore((s) => s.connectJira);
  const [status, setStatus] = React.useState<'loading' | 'error'>('loading');

  React.useEffect(() => {
    fetch('/api/auth/jira/session')
      .then((r) => r.json())
      .then(({ connection, error }) => {
        if (connection) {
          connectJira(connection);
          router.replace('/settings');
        } else {
          console.error('[jira-connect] No connection in session:', error);
          setStatus('error');
          setTimeout(() => router.replace('/settings?jira=error'), 2000);
        }
      })
      .catch((err) => {
        console.error('[jira-connect]', err);
        setStatus('error');
        setTimeout(() => router.replace('/settings?jira=error'), 2000);
      });
  }, [connectJira, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      {status === 'loading' ? (
        <>
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-muted">Connexion Jira en cours…</p>
        </>
      ) : (
        <p className="text-sm text-error">Échec de la connexion. Redirection…</p>
      )}
    </div>
  );
}
