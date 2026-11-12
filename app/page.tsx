'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, CalendarRange, Gauge, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/layout';
import { JiraLogo } from '@/components/features';
import { Spinner } from '@/components/ui';

const ERRORS: Record<string, string> = {
  invalid_state: 'La connexion a expiré ou a été ouverte dans un autre onglet. Réessayez.',
  google_denied: 'Connexion Google annulée.',
  token_exchange: "Google a refusé l'échange du code (vérifiez GOOGLE_CLIENT_SECRET et l'URI de redirection).",
  email_not_verified: "Votre adresse Google n'est pas vérifiée.",
  not_allowed: "Ce compte Google n'est pas autorisé sur cette application.",
  max_users: "Le nombre maximum d'utilisateurs est atteint.",
  google_not_configured: "La connexion Google n'est pas configurée sur le serveur (GOOGLE_CLIENT_ID).",
  session: 'Votre session a expiré, reconnectez-vous.',
  server: 'Erreur serveur pendant la connexion (base de données ou SESSION_SECRET ?).',
};

const FEATURES = [
  { icon: Gauge, title: 'Points → temps', text: 'Notez chaque tâche sur 10, la durée est calculée pour vous.' },
  { icon: CalendarRange, title: 'Calendrier vivant', text: 'Vos tâches en cartes, à glisser-déposer sur la semaine.' },
  { icon: JiraLogo, title: 'Synchronisé avec Jira', text: 'Tickets créés et temps loggé automatiquement.' },
  { icon: BarChart3, title: 'Rapports', text: 'Graphiques, historique et exports PDF / CSV.' },
];

export default function LoginPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) {
      setError(ERRORS[code] ?? `Connexion impossible (${code}).`);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-5 h-16 w-16 rounded-2xl" />
          <h1 className="text-3xl font-bold tracking-tight">Daily Tracker</h1>
          <p className="mt-2 text-muted">Suivez, planifiez et synchronisez votre journée de travail.</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 flex gap-2 rounded-xl bg-error/10 p-3 text-sm text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <a
            href="/api/auth/google"
            onClick={() => setLoading(true)}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-[15px] font-medium shadow-sm transition hover:bg-surface active:scale-[0.99]"
          >
            {loading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continuer avec Google
          </a>
          <p className="mt-4 text-center text-xs text-muted">
            Vos données sont enregistrées dans votre compte et synchronisées sur tous vos appareils.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="rounded-2xl border border-border bg-card/60 p-4"
            >
              <f.icon className="mb-2 h-5 w-5 text-accent" />
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.text}</p>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <RefreshCw className="h-3 w-3" /> Problème de connexion ?{' '}
          <a href="/api/health" className="underline hover:text-foreground">Diagnostic</a>
        </p>
      </motion.div>
    </div>
  );
}
