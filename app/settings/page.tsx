'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  User, 
  Bell, 
  Palette, 
  Shield, 
  Download,
  Trash2,
  Moon,
  Sun,
  Monitor,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, user, entries, updateUserSettings, logout } = useStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    user?.settings.notificationsEnabled || false
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const themeOptions: SelectOption[] = [
    { value: 'system', label: 'Système', icon: <Monitor className="h-4 w-4" /> },
    { value: 'light', label: 'Clair', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Sombre', icon: <Moon className="h-4 w-4" /> },
  ];

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Les notifications ne sont pas supportées par votre navigateur');
      return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      updateUserSettings({ notificationsEnabled: true });
      
      // Show test notification
      new Notification('Daily Tracker', {
        body: 'Les notifications sont maintenant activées !',
        icon: '/icon-192.png',
      });
    }
  };

  const handleExportData = () => {
    const data = {
      user: user ? { ...user, pin: undefined } : null,
      entries,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-muted">
            Personnalisez votre expérience Daily Tracker
          </p>
        </div>

        {/* Profile */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-accent" />
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-lg">{user.name}</p>
                <p className="text-sm text-muted">
                  Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold">{entries.length}</p>
                <p className="text-xs text-muted">Entrées</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{user.gamification.totalTasks}</p>
                <p className="text-xs text-muted">Tâches</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{user.gamification.badges.length}</p>
                <p className="text-xs text-muted">Badges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5 text-accent" />
              Apparence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mounted && (
              <Select
                label="Thème"
                options={themeOptions}
                value={theme || 'system'}
                onChange={(v) => setTheme(v)}
              />
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-accent" />
              Notifications
            </CardTitle>
            <CardDescription>
              Recevez des rappels pour valider votre journée
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications push</p>
                <p className="text-sm text-muted">
                  Rappels à 16h55, 17h30 et 18h00
                </p>
              </div>
              {notificationsEnabled ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  Activées
                </Badge>
              ) : (
                <Button onClick={handleEnableNotifications}>
                  Activer
                </Button>
              )}
            </div>

            {notificationsEnabled && (
              <div className="flex flex-wrap gap-2">
                {user.settings.notificationTimes.map((time) => (
                  <Badge key={time} variant="outline">
                    {time}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-accent" />
              Données
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter mes données (JSON)
            </Button>

            <div className="border-t border-border pt-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-error/5 border border-error/20">
                <AlertTriangle className="h-5 w-5 text-error shrink-0" />
                <div>
                  <p className="font-medium text-error">Zone de danger</p>
                  <p className="text-sm text-muted mt-1">
                    Les actions suivantes sont irréversibles
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer toutes vos données ?')) {
                        localStorage.clear();
                        router.push('/');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer mes données
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card variant="bordered">
          <CardContent className="py-4 text-center text-sm text-muted">
            <p>Daily Tracker v1.0.0</p>
            <p className="mt-1">
              Fait avec ❤️ pour les équipes agiles
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
