'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  History,
  LogOut,
  Moon,
  Presentation,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout, useMe } from '@/lib/client/data';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: "Aujourd'hui", short: 'Jour', icon: CalendarDays, match: (p) => p === '/dashboard' || p.startsWith('/day/') },
  { href: '/planning', label: 'Planning', short: 'Planning', icon: CalendarRange },
  { href: '/history', label: 'Historique', short: 'Historique', icon: History },
  { href: '/reports', label: 'Rapports', short: 'Rapports', icon: BarChart3 },
  { href: '/daily-meeting', label: 'Daily meeting', short: 'Daily', icon: Presentation },
];

function isActive(item: NavItem, path: string) {
  return item.match ? item.match(path) : path.startsWith(item.href);
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-500 text-white shadow-soft', className)}>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5l4.5 4.5L20 6" />
      </svg>
    </div>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn('flex items-center gap-3 rounded-xl text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground', className)}
      aria-label="Changer de thème"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      <span className="lg:inline">{mounted ? (dark ? 'Mode clair' : 'Mode sombre') : 'Thème'}</span>
    </button>
  );
}

function Avatar({ src, name, className }: { src?: string | null; name?: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" className={cn('rounded-full object-cover', className)} />;
  }
  return (
    <div className={cn('flex items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent', className)}>
      {(name ?? '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { data: me } = useMe();

  return (
    <>
      {/* ── Barre latérale desktop ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-3 px-5">
          <Logo className="h-9 w-9" />
          <div className="leading-tight">
            <p className="font-semibold">Daily Tracker</p>
            <p className="text-xs text-muted">Suivi & planification</p>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'text-accent' : 'text-muted hover:bg-surface hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-accent/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className="relative h-[18px] w-[18px]" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              pathname.startsWith('/settings') ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface hover:text-foreground',
            )}
          >
            <Settings className="h-[18px] w-[18px]" />
            Paramètres
          </Link>
          <ThemeToggle className="w-full px-3 py-2.5" />
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
            <Avatar src={me?.avatar} name={me?.name} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me?.name ?? '…'}</p>
              <p className="truncate text-xs text-muted">{me?.email}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-1.5 text-muted transition hover:bg-card hover:text-error" aria-label="Déconnexion" title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── En-tête mobile ── */}
      <header className="glass fixed inset-x-0 top-0 z-40 border-b border-border safe-top lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-semibold">Daily Tracker</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle className="p-2 [&>span]:hidden" />
            <Link href="/settings" className="rounded-full p-1" aria-label="Paramètres">
              <Avatar src={me?.avatar} name={me?.name} className="h-8 w-8" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Navigation basse mobile ── */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border safe-bottom lg:hidden">
        <div className="flex h-16 items-stretch justify-around px-1">
          {NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors', active ? 'text-accent' : 'text-muted')}
              >
                {active && (
                  <motion.span layoutId="bottom-nav-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                )}
                <item.icon className="h-5 w-5" />
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
