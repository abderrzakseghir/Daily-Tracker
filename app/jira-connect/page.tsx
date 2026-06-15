'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

/**
 * Intermediate page for Jira OAuth callback.
 * No auth guard — reads connection data from URL fragment (never sent to server),
 * stores it in Zustand, clears the URL, then redirects to Settings.
 */
export default function JiraConnectPage() {
  const router = useRouter();
  const connectJira = useStore((s) => s.connectJira);
  const [status, setStatus] = React.useState<'loading' | 'error'>('loading');

  React.useEffect(() => {
    try {
      const hash = window.location.hash.slice(1); // remove leading #
      if (!hash) throw new Error('No data in URL fragment');

      const connection = JSON.parse(atob(hash.replace(/-/g, '+').replace(/_/g, '/')));
      if (!connection?.accountId) throw new Error('Invalid connection data');

      // Clear the fragment from URL immediately (tokens should not stay in history)
      window.history.replaceState(null, '', window.location.pathname);

      connectJira(connection);
      router.replace('/settings');
    } catch (err) {
      console.error('[jira-connect]', err);
      setStatus('error');
      setTimeout(() => router.replace('/settings?jira=error'), 2000);
    }
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
