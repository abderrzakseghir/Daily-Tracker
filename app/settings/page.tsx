'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, Clock, Database, Download, LogOut, Plus, Repeat, Scale, Trash2, Unplug, User as UserIcon } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components/layout';
import { Button, Field, inputClass, Modal, PointsBadge, PointsPicker, Segmented, Skeleton, Switch } from '@/components/ui';
import { JiraLogo } from '@/components/features';
import { cn } from '@/lib/utils';
import { api } from '@/lib/client/api';
import { logout, updateSettings, useJiraProjects, useMe, useTemplates } from '@/lib/client/data';
import { computeDurations, dayCapacity, formatDuration, parseDuration } from '@/lib/planner';
import { toast } from '@/lib/store';
import { CATEGORIES, CATEGORY_EMOJIS, CATEGORY_LABELS, type Category, type User, type UserSettings } from '@/types';

const WEEKDAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'M' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 7, label: 'D' },
];

const JIRA_ERRORS: Record<string, string> = {
  denied: 'Autorisation refusée sur Atlassian.',
  invalid_state: 'La session de connexion a expiré, réessayez.',
  token_exchange: "Échange du code impossible — vérifiez JIRA_CLIENT_SECRET et l'URL de callback déclarée chez Atlassian.",
  no_site: 'Aucun site Jira accessible avec ce compte.',
  not_configured: "Jira n'est pas configuré sur le serveur (JIRA_CLIENT_ID).",
};

export default function SettingsPage() {
  const { data: user } = useMe();
  return (
    <AppLayout>
      <PageHeader title="Paramètres" subtitle="Personnalisez votre journée, votre calcul du temps et Jira" />
      <React.Suspense>{user ? <SettingsContent user={user} /> : <Skeleton className="h-[60vh]" />}</React.Suspense>
    </AppLayout>
  );
}

function SettingsContent({ user }: { user: User }) {
  const s = user.settings;
  const params = useSearchParams();
  const router = useRouter();
  const set = (patch: Partial<UserSettings>) => updateSettings(patch);

  React.useEffect(() => {
    const status = params.get('jira');
    if (!status) return;
    if (status === 'connected') toast('Jira connecté ✓', 'success');
    else toast(`Connexion Jira échouée : ${JIRA_ERRORS[params.get('reason') ?? ''] ?? params.get('reason')}`, 'error');
    router.replace('/settings');
  }, [params, router]);

  // Fuseau détecté automatiquement (utile pour dater les worklogs Jira)
  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== s.timezone) set({ timezone: tz });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Profil */}
      <Section icon={<UserIcon className="h-4 w-4" />} title="Profil">
        <div className="flex items-center gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-xl font-bold text-accent">{user.name[0]}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email} · compte Google</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </Section>

      {/* Journée */}
      <Section icon={<Clock className="h-4 w-4" />} title="Journée de travail" description="Sert à placer vos tâches sur le calendrier.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Début">
            <input type="time" step={900} value={s.workdayStart} onChange={(e) => e.target.value && set({ workdayStart: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Fin">
            <input type="time" step={900} value={s.workdayEnd} onChange={(e) => e.target.value && set({ workdayEnd: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Switch checked={s.lunchEnabled} onChange={(v) => set({ lunchEnabled: v })} label="Pause déjeuner" description="Les tâches sont découpées autour de la pause." />
        {s.lunchEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Début de pause">
              <input type="time" step={900} value={s.lunchStart} onChange={(e) => e.target.value && set({ lunchStart: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Fin de pause">
              <input type="time" step={900} value={s.lunchEnd} onChange={(e) => e.target.value && set({ lunchEnd: e.target.value })} className={inputClass} />
            </Field>
          </div>
        )}
        <Field label="Jours travaillés">
          <WeekdayPicker value={s.workdays} onChange={(workdays) => set({ workdays })} />
        </Field>
        <p className="text-xs text-muted">
          Capacité : <strong className="text-foreground">{formatDuration(dayCapacity(s))}</strong> par jour · fuseau {s.timezone}
        </p>
      </Section>

      {/* Calcul du temps */}
      <Section icon={<Scale className="h-4 w-4" />} title="Points → temps" description="Comment vos points (1 à 10) deviennent une durée.">
        <Segmented
          value={s.durationMode}
          onChange={(durationMode) => set({ durationMode })}
          options={[
            { value: 'proportional', label: 'Répartir la journée' },
            { value: 'perPoint', label: 'Minutes par point' },
          ]}
        />
        {s.durationMode === 'perPoint' && (
          <Field label="Minutes par point" hint={`10 points = ${formatDuration(10 * s.minutesPerPoint)}`}>
            <input
              type="number"
              min={5}
              max={240}
              step={5}
              value={s.minutesPerPoint}
              onChange={(e) => Number(e.target.value) >= 5 && set({ minutesPerPoint: Number(e.target.value) })}
              className={cn(inputClass, 'w-32')}
            />
          </Field>
        )}
        <DurationPreview settings={s} />
        <Field label="Catégorie par défaut">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => set({ defaultCategory: c })}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', s.defaultCategory === c ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-surface')}
              >
                {CATEGORY_EMOJIS[c]} {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <JiraSection user={user} />
      <TemplatesSection />

      {/* Focus & rappels */}
      <Section icon={<Bell className="h-4 w-4" />} title="Focus & rappels">
        <Field label="Durée d'une session focus" hint="minutes">
          <Segmented
            size="sm"
            value={String(s.focusMinutes)}
            onChange={(v) => set({ focusMinutes: Number(v) })}
            options={['15', '25', '45', '50', '90'].map((v) => ({ value: v, label: v }))}
          />
        </Field>
        <PushToggle enabled={s.reminderEnabled} />
      </Section>

      <DataSection />
    </div>
  );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: React.ReactNode; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== d.value) : [...value, d.value].sort())}
            className={cn('h-9 w-9 rounded-xl text-sm font-semibold transition', on ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-border')}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/** Exemple concret du calcul avec les réglages actuels. */
function DurationPreview({ settings }: { settings: UserSettings }) {
  const example = [
    { id: 'a', label: 'Fonctionnalité', points: 6 },
    { id: 'b', label: 'Revue de code', points: 3 },
    { id: 'c', label: 'E-mails', points: 1 },
  ];
  const d = computeDurations(example.map((e) => ({ ...e, manualDuration: null })), settings);
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-muted">Exemple avec 3 tâches</p>
      <div className="space-y-1.5">
        {example.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-sm">
            <PointsBadge points={e.points} />
            <span className="flex-1">{e.label}</span>
            <span className="font-semibold tabular-nums">{formatDuration(d.get(e.id) ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JiraSection({ user }: { user: User }) {
  const s = user.settings;
  const { data: projects, error } = useJiraProjects(user.jira.connected);
  const [confirm, setConfirm] = React.useState(false);

  const disconnect = async () => {
    try {
      await api('/api/jira/connection', { method: 'DELETE' });
      toast('Jira déconnecté', 'info');
      window.location.reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Section icon={<JiraLogo className="h-4 w-4" />} title="Jira" description="Créez des tickets depuis vos tâches et loggez le temps automatiquement.">
      {!user.jira.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-4">
          <p className="text-sm text-muted">Aucun compte Jira connecté.</p>
          <Button onClick={() => (window.location.href = '/api/auth/jira')}>
            <JiraLogo className="h-4 w-4" /> Connecter Jira
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0052CC]/5 p-4">
            {user.jira.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.jira.avatar} alt="" className="h-10 w-10 rounded-full" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{user.jira.displayName}</p>
              <a href={user.jira.cloudUrl} target="_blank" rel="noreferrer" className="text-sm text-[#0052CC] hover:underline dark:text-[#4C9AFF]">
                {user.jira.siteName ?? user.jira.cloudUrl}
              </a>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} className="text-error hover:bg-error/10 hover:text-error">
              <Unplug className="h-4 w-4" /> Déconnecter
            </Button>
          </div>
          {error && <p className="text-sm text-error">{(error as Error).message}</p>}
          <Field label="Projet par défaut">
            <select value={s.defaultJiraProject ?? ''} onChange={(e) => updateSettings({ defaultJiraProject: e.target.value || null })} className={inputClass}>
              <option value="">— Aucun —</option>
              {projects?.map((p) => (
                <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
              ))}
            </select>
          </Field>
          <Switch
            checked={s.autoCreateJiraIssue}
            disabled={!s.defaultJiraProject}
            onChange={(v) => updateSettings({ autoCreateJiraIssue: v })}
            label="Créer un ticket pour chaque nouvelle tâche"
            description="Dans le projet par défaut, assigné à vous, avec l'estimation."
          />
          <Switch
            checked={s.autoSyncWorklog}
            onChange={(v) => updateSettings({ autoSyncWorklog: v })}
            label="Logger le temps automatiquement"
            description="Le worklog est créé quand la tâche est terminée et mis à jour si sa durée ou son horaire change. Sinon, à la validation de la journée."
          />
          <Switch
            checked={s.autoTransitionDone}
            onChange={(v) => updateSettings({ autoTransitionDone: v })}
            label="Passer le ticket à « Terminé »"
            description="Quand la tâche liée est terminée."
          />
        </>
      )}
      <Modal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Déconnecter Jira ?"
        description="Les tâches restent liées à leurs tickets ; la synchronisation reprendra à la reconnexion."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Annuler</Button>
            <Button variant="destructive" onClick={disconnect}>Déconnecter</Button>
          </>
        }
      >
        <span />
      </Modal>
    </Section>
  );
}

function TemplatesSection() {
  const { data: templates, mutate } = useTemplates();
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState<Category>('meeting');
  const [points, setPoints] = React.useState(2);
  const [duration, setDuration] = React.useState('15min');
  const [time, setTime] = React.useState('');
  const [weekdays, setWeekdays] = React.useState<number[]>([1, 2, 3, 4, 5]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api('/api/templates', {
        method: 'POST',
        json: { title, category, points, manualDuration: duration ? parseDuration(duration) : null, startTime: time || null, weekdays },
      });
      setTitle('');
      mutate();
      toast('Tâche récurrente ajoutée', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const remove = async (id: string) => {
    mutate((list) => list?.filter((t) => t.id !== id), { revalidate: false });
    await api(`/api/templates/${id}`, { method: 'DELETE' }).catch(() => mutate());
  };

  return (
    <Section icon={<Repeat className="h-4 w-4" />} title="Tâches récurrentes" description="Daily, revue de sprint, mails… proposées automatiquement les jours choisis.">
      {templates && templates.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <span>{CATEGORY_EMOJIS[t.category]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted">
                  {t.weekdays.length ? t.weekdays.map((d) => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][d - 1]).join(', ') : 'Manuel'}
                  {t.startTime && ` · ${t.startTime}`}
                  {t.manualDuration && ` · ${formatDuration(t.manualDuration)}`}
                </p>
              </div>
              <PointsBadge points={t.points} />
              <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-muted hover:bg-error/10 hover:text-error" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="space-y-3 rounded-xl bg-surface p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Daily scrum" className={inputClass} />
        <div className="grid gap-3 sm:grid-cols-3">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Durée (ex. 15min)" className={inputClass} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} title="Horaire fixe (optionnel)" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PointsPicker compact value={points} onChange={setPoints} />
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </div>
        <Button type="submit" size="sm" disabled={!title.trim()}>
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </form>
    </Section>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function PushToggle({ enabled }: { enabled: boolean }) {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const toggle = async (on: boolean) => {
    try {
      if (on) {
        if (!vapid) throw new Error('Notifications non configurées sur le serveur (clés VAPID).');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Autorisez les notifications dans votre navigateur.');
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
        await api('/api/push', { method: 'POST', json: sub.toJSON() });
      } else {
        await api('/api/push', { method: 'DELETE' });
      }
      await updateSettings({ reminderEnabled: on });
      toast(on ? 'Rappel activé' : 'Rappel désactivé', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <Switch
      checked={enabled}
      disabled={!supported}
      onChange={toggle}
      label="Rappel de fin de journée"
      description={supported ? "Notification en fin d'après-midi si la journée n'est pas validée (jours travaillés)." : 'Non disponible sur ce navigateur.'}
    />
  );
}

function DataSection() {
  const [confirm, setConfirm] = React.useState(false);
  const [text, setText] = React.useState('');

  const remove = async () => {
    try {
      await fetch('/api/me', { method: 'DELETE' });
      window.location.href = '/';
    } catch {
      toast('Suppression impossible', 'error');
    }
  };

  return (
    <Section icon={<Database className="h-4 w-4" />} title="Données" description="Vos données sont stockées dans la base Supabase de l'application.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => (window.location.href = '/api/export')}>
          <Download className="h-4 w-4" /> Exporter (JSON)
        </Button>
        <Button variant="ghost" size="sm" className="text-error hover:bg-error/10 hover:text-error" onClick={() => setConfirm(true)}>
          <Trash2 className="h-4 w-4" /> Supprimer mon compte
        </Button>
      </div>
      <Modal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Supprimer le compte ?"
        description="Toutes vos tâches, journées et la connexion Jira seront effacées définitivement. Les tickets Jira ne sont pas touchés."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Annuler</Button>
            <Button variant="destructive" disabled={text !== 'SUPPRIMER'} onClick={remove}>Supprimer</Button>
          </>
        }
      >
        <Field label="Tapez SUPPRIMER pour confirmer">
          <input value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        </Field>
      </Modal>
    </Section>
  );
}
