'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Flame } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loginWithGoogle, _hasHydrated } = useStore();
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Redirect authenticated users immediately
  React.useEffect(() => {
    if (_hasHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Claim pending Google session after OAuth redirect
  React.useEffect(() => {
    if (!_hasHydrated) return;

    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('google');

    if (googleStatus === 'error') {
      const reason = params.get('reason') ?? 'unknown';
      window.history.replaceState({}, '', '/');
      setError(`La connexion Google a échoué (${reason}). Réessayez.`);
      return;
    }

    // Try to claim a pending Google session cookie
    setIsLoading(true);
    fetch('/api/auth/google/session')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.userInfo) {
          loginWithGoogle(data.userInfo);
        }
      })
      .catch(() => {
        // No pending session — normal on first visit
      })
      .finally(() => setIsLoading(false));
  }, [_hasHydrated, loginWithGoogle]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-4">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Daily Tracker</h1>
          <p className="text-muted mt-2">
            Préparez vos Daily Scrum en toute simplicité
          </p>
        </div>

        {/* Auth card */}
        <Card variant="elevated">
          <CardHeader className="text-center">
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Connectez-vous avec votre compte Google pour continuer
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}

            <Button
              size="lg"
              className="w-full gap-3"
              onClick={handleGoogleLogin}
              isLoading={isLoading}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuer avec Google
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl mb-1">📝</div>
            <p className="text-muted">Journal quotidien</p>
          </div>
          <div>
            <div className="text-2xl mb-1">📊</div>
            <p className="text-muted">Statistiques</p>
          </div>
          <div>
            <div className="text-2xl mb-1">📄</div>
            <p className="text-muted">Export PDF</p>
          </div>
        </div>
      </div>
    </div>
  );
}

