'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/** Fenêtre modale — centrée sur desktop, feuille glissante sur mobile. */
export function Modal({ isOpen, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative z-50 flex max-h-[92vh] w-full flex-col overflow-hidden bg-card shadow-card',
              'rounded-t-3xl sm:mx-4 sm:rounded-2xl',
              sizeClasses[size],
            )}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="-mr-1 rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 safe-bottom sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
