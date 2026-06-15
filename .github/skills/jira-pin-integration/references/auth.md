# PIN Authentication — Implementation Reference

## Overview

Stateless PIN auth stored entirely in localStorage via Zustand `persist`.
No backend required. No paid deps.

---

## Dependencies

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

---

## `services/auth.ts`

```ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const SESSION_KEY = 'daily_tracker_session';

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function createSession(): string {
  const token = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, token);
  return token;
}

export function getSession(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{4,6}$/.test(pin)) {
    return { valid: false, error: 'Le PIN doit contenir 4 à 6 chiffres' };
  }
  return { valid: true };
}
```

---

## `hooks/useAuth.ts`

```ts
import { useStore } from '@/lib/store';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    login,
    logout,
    createUser,
  } = useStore();

  return {
    user,
    isAuthenticated,
    login,
    logout,
    createUser,
  };
}
```

---

## Store Integration (`lib/store.ts`)

Extend the existing Zustand store with these auth actions:

```ts
// Inside create<AppState>() persist callback:

login: async (pin: string) => {
  const { user } = get();
  if (!user) return false;
  const valid = await verifyPin(pin, user.pinHash);
  if (valid) {
    createSession();
    set({ isAuthenticated: true });
  }
  return valid;
},

logout: () => {
  clearSession();
  set({ isAuthenticated: false });
},

createUser: async (firstName: string, lastName: string, pin: string) => {
  const pinHash = await hashPin(pin);
  const newUser: User = {
    id: generateId(),
    firstName,
    lastName,
    pinHash,
    createdAt: new Date().toISOString(),
    settings: { /* defaults */ },
  };
  createSession();
  set({ user: newUser, isAuthenticated: true });
},
```

---

## Session Restore on Boot

In `app/providers.tsx` or a `<AuthGuard>` component:

```tsx
'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getSession } from '@/services/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setAuthenticated } = useStore();

  useEffect(() => {
    // Restore session if token present and user exists
    if (user && !isAuthenticated && getSession()) {
      setAuthenticated(true);
    }
  }, []);

  return <>{children}</>;
}
```

---

## Welcome Screen (`components/features/auth-screen.tsx`)

```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { validatePin } from '@/services/auth';

type Tab = 'login' | 'register';

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const { login, createUser } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-8">Daily Tracker</h1>

        {/* Tab switcher */}
        <div className="flex border rounded-lg mb-6 overflow-hidden">
          <button
            className={`flex-1 py-2 text-sm transition-colors ${tab === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            onClick={() => setTab('login')}
          >
            Se connecter
          </button>
          <button
            className={`flex-1 py-2 text-sm transition-colors ${tab === 'register' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            onClick={() => setTab('register')}
          >
            Créer un compte
          </button>
        </div>

        {tab === 'login' ? (
          <LoginForm onLogin={login} />
        ) : (
          <RegisterForm onCreate={createUser} />
        )}
      </div>
    </div>
  );
}
```

---

## Route Guard in Root Layout

In `app/layout.tsx`, wrap content conditionally:

```tsx
// app/page.tsx or app/layout.tsx
import { AuthScreen } from '@/components/features/auth-screen';

// In the component:
if (!isAuthenticated) return <AuthScreen />;
```

---

## Security Notes

- PIN hash: bcryptjs, 10 rounds — safe for client-side hashing
- `sessionStorage` token: cleared on tab close, restored on reload within same tab
- Jira tokens: never stored in plain text (see Jira reference)
- No PIN is ever sent to any server
