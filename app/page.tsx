'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Flame, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, login, createUser } = useStore();
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [name, setName] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    // If user exists, show login mode
    if (user) {
      setMode('login');
    } else {
      setMode('register');
    }
  }, [user]);

  const handleLogin = async () => {
    if (pin.length < 4) {
      setError('Le code PIN doit contenir au moins 4 chiffres');
      return;
    }

    setIsLoading(true);
    setError('');

    const success = await login(pin);

    if (success) {
      router.push('/dashboard');
    } else {
      setError('Code PIN incorrect');
    }

    setIsLoading(false);
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      setError('Le code PIN doit contenir 4 à 6 chiffres');
      return;
    }

    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      return;
    }

    setIsLoading(true);
    setError('');

    await createUser(name.trim(), pin);
    router.push('/dashboard');
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

        {/* Form */}
        <Card variant="elevated">
          <CardHeader className="text-center">
            <CardTitle>
              {mode === 'login' ? `Bonjour, ${user?.name}` : 'Créer un compte'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Entrez votre code PIN pour continuer'
                : 'Configurez votre compte en quelques secondes'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Votre prénom"
                placeholder="Jean"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            )}

            <Input
              label="Code PIN"
              type="password"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(value);
              }}
              inputMode="numeric"
              maxLength={6}
              autoFocus={mode === 'login'}
            />

            {mode === 'register' && (
              <Input
                label="Confirmer le code PIN"
                type="password"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setConfirmPin(value);
                }}
                inputMode="numeric"
                maxLength={6}
              />
            )}

            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={mode === 'login' ? handleLogin : handleRegister}
              isLoading={isLoading}
            >
              {mode === 'login' ? 'Se connecter' : "C'est parti !"}
              <ChevronRight className="h-4 w-4" />
            </Button>

            {user && mode === 'login' && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode('register')}
              >
                Créer un nouveau compte
              </Button>
            )}
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
