'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Home,
  Calendar,
  FileText,
  Settings,
  Presentation,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface NavigationProps {
  onLogout?: () => void;
}

export function Navigation({ onLogout }: NavigationProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const navItems = [
    { href: '/dashboard', label: "Aujourd'hui", icon: Home },
    { href: '/history', label: 'Historique', icon: Calendar },
    { href: '/reports', label: 'Rapports', icon: FileText },
    { href: '/daily-meeting', label: 'Daily', icon: Presentation },
    { href: '/settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg safe-top lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">DT</span>
            </div>
            <span className="font-semibold">Daily Tracker</span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-background pt-14 lg:hidden animate-fade-in">
          <nav className="flex flex-col p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-muted hover:bg-muted/10 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}

            <div className="border-t border-border my-4" />

            <button
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted hover:bg-muted/10 hover:text-foreground"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              {mounted && (theme === 'dark' ? 'Mode clair' : 'Mode sombre')}
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-error hover:bg-error/10"
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 border-r border-border bg-card lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-border px-6">
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-white font-bold">DT</span>
            </div>
            <span className="font-semibold text-lg">Daily Tracker</span>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-muted hover:bg-muted/10 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4 space-y-1">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-muted/10 hover:text-foreground"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              {mounted && (theme === 'dark' ? 'Mode clair' : 'Mode sombre')}
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-error hover:bg-error/10"
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-lg safe-bottom lg:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors',
                  isActive ? 'text-accent' : 'text-muted'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
