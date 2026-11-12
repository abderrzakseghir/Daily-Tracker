import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store d'interface uniquement (toasts, minuteur focus, préférences locales).
 * Les données métier vivent dans Supabase et sont mises en cache par SWR
 * (voir lib/client/data.ts).
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface FocusSession {
  taskId: string;
  taskTitle: string;
  date: string;
  startedAt: number;
  targetMinutes: number;
  /** Cumul des tranches précédentes (pause/reprise), en ms. */
  accumulatedMs: number;
  paused: boolean;
}

interface UiState {
  toasts: Toast[];
  toast: (message: string, tone?: ToastTone, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;

  focus: FocusSession | null;
  startFocus: (s: Omit<FocusSession, 'startedAt' | 'accumulatedMs' | 'paused'>) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  /** Termine la session et retourne les minutes écoulées. */
  stopFocus: () => { session: FocusSession; minutes: number } | null;

  planningView: 'week' | 'workweek' | 'day';
  setPlanningView: (v: UiState['planningView']) => void;
  legacyImportDismissed: boolean;
  dismissLegacyImport: () => void;
}

let toastSeq = 0;

export function focusElapsedMs(f: FocusSession): number {
  return f.accumulatedMs + (f.paused ? 0 : Date.now() - f.startedAt);
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      toasts: [],
      toast: (message, tone = 'info', action) => {
        const id = ++toastSeq;
        set({ toasts: [...get().toasts.slice(-3), { id, tone, message, action }] });
        setTimeout(() => get().dismissToast(id), tone === 'error' ? 7000 : 4000);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

      focus: null,
      startFocus: (s) =>
        set({ focus: { ...s, startedAt: Date.now(), accumulatedMs: 0, paused: false } }),
      pauseFocus: () => {
        const f = get().focus;
        if (!f || f.paused) return;
        set({ focus: { ...f, accumulatedMs: focusElapsedMs(f), paused: true } });
      },
      resumeFocus: () => {
        const f = get().focus;
        if (!f || !f.paused) return;
        set({ focus: { ...f, startedAt: Date.now(), paused: false } });
      },
      stopFocus: () => {
        const f = get().focus;
        if (!f) return null;
        set({ focus: null });
        return { session: f, minutes: Math.round(focusElapsedMs(f) / 60000) };
      },

      planningView: 'workweek',
      setPlanningView: (planningView) => set({ planningView }),
      legacyImportDismissed: false,
      dismissLegacyImport: () => set({ legacyImportDismissed: true }),
    }),
    {
      name: 'daily-tracker-ui',
      partialize: (s) => ({
        focus: s.focus,
        planningView: s.planningView,
        legacyImportDismissed: s.legacyImportDismissed,
      }),
    },
  ),
);

export const toast = (message: string, tone?: ToastTone, action?: Toast['action']) =>
  useUi.getState().toast(message, tone, action);
