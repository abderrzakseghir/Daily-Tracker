'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useUi } from '@/lib/store';
import { cn } from '@/lib/utils';

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-accent',
};

export function Toaster() {
  const { toasts, dismissToast } = useUi();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
              role="status"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONES[t.tone])} />
              <p className="flex-1 whitespace-pre-line text-sm">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismissToast(t.id);
                  }}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismissToast(t.id)} className="text-muted hover:text-foreground" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
