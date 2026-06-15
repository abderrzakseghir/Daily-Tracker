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
  AlertTriangle,
  Link2,
  Link2Off,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, user, entries, updateUserSettings, logout, _hasHydrated } = useStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    user?.settings.notificationsEnabled || false
  );
  const [jiraTickets, setJiraTickets] = React.useState<import('@/types').JiraTicket[]>([]);
  const [jiraLoading, setJiraLoading] = React.useState(false);
  const [jiraError, setJiraError] = React.useState<string | null>(null);

  const { connectJira, disconnectJira } = useStore();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Claim Jira connection after OAuth redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jiraStatus = params.get('jira');
    if (jiraStatus === 'error') {
      window.history.replaceState({}, '', '/settings');
      setJiraError('La connexion Jira a échoué. Réessayez.');
    }
  }, []);

  React.useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.push('/');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  const themeOptions: SelectOption[] = [
    { value: 'system', label: 'Système', icon: <Monitor className="h-4 w-4" /> },
    { value: 'light', label: 'Clair', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Sombre', icon: <Moon className="h-4 w-4" /> },
  ];

  const fetchJiraTickets = React.useCallback(async () => {
    // Read fresh state to avoid stale closure
    const jira = useStore.getState().user?.jira;
    if (!jira?.accessToken || !jira?.cloudId || !jira?.accountId) return;
    setJiraLoading(true);
    setJiraError(null);
    try {
      const res = await fetch('/api/jira/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: jira.accessToken,
          cloudId: jira.cloudId,
          accountId: jira.accountId,
          cloudUrl: jira.cloudUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur Jira');
      setJiraTickets(data.tickets);
    } catch (err: any) {
      setJiraError(err.message || 'Impossible de récupérer les tickets');
    } finally {
      setJiraLoading(false);
    }
  }, []); // always reads fresh from store.getState()

  // Auto-fetch tickets when Jira is connected
  React.useEffect(() => {
    if (user?.jira) fetchJiraTickets();
  }, [user?.jira?.accountId, fetchJiraTickets]);

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

        {/* Jira */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11.75 2L2 11.75l4.5 4.5L11.75 11l5.25 5.25L21.5 11.75 11.75 2z" fill="#2684FF"/>
                <path d="M11.75 22l9.75-9.75-4.5-4.5L11.75 13l-5.25-5.25L2 12.25 11.75 22z" fill="#2684FF" opacity=".6"/>
              </svg>
              Connexion Jira
            </CardTitle>
            <CardDescription>
              Connectez votre compte Jira pour retrouver vos tickets assignés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user?.jira ? (
              /* Not connected */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-muted" />
                  <span className="text-sm text-muted">Non connecté</span>
                </div>
                <Button
                  onClick={() => { window.location.href = '/api/auth/jira'; }}
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Connecter mon compte Jira
                </Button>
              </div>
            ) : (
              /* Connected */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-medium text-sm">{user.jira.displayName}</p>
                      <p className="text-xs text-muted">{user.jira.email}</p>
                      <p className="text-xs text-muted">{user.jira.cloudUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchJiraTickets}
                      disabled={jiraLoading}
                      className="gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${jiraLoading ? 'animate-spin' : ''}`} />
                      Synchroniser
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { disconnectJira(); setJiraTickets([]); }}
                      className="gap-1 text-error hover:text-error"
                    >
                      <Link2Off className="h-3 w-3" />
                      Déconnecter
                    </Button>
                  </div>
                </div>

                {/* Error */}
                {jiraError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {jiraError}
                  </div>
                )}

                {/* Ticket list */}
                {jiraLoading && jiraTickets.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : jiraTickets.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted uppercase tracking-wide">
                      {jiraTickets.length} ticket{jiraTickets.length > 1 ? 's' : ''} assigné{jiraTickets.length > 1 ? 's' : ''}
                    </p>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {jiraTickets.map((ticket) => (
                        <div
                          key={ticket.key}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-mono text-xs font-semibold text-accent shrink-0 mt-0.5 bg-accent/10 px-1.5 py-0.5 rounded">
                            {ticket.key}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ticket.summary}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted">{ticket.project}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                ticket.status === 'Done' || ticket.status === 'Terminé'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : ticket.status === 'In Progress' || ticket.status === 'En cours'
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  : 'bg-muted/50 text-muted'
                              }`}>
                                {ticket.status}
                              </span>
                              {ticket.sprint && (
                                <span className="text-xs text-muted">{ticket.sprint}</span>
                              )}
                            </div>
                          </div>
                          <a
                            href={`${user.jira!.cloudUrl}/browse/${ticket.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted hover:text-foreground transition-colors"
                            aria-label={`Ouvrir ${ticket.key} dans Jira`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !jiraLoading && (
                  <p className="text-sm text-muted text-center py-4">
                    Aucun ticket assigné pour le moment.
                  </p>
                )}
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
