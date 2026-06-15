import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, ...props }, ref) => {
    const id = React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
              {icon}
            </div>
          )}
          <input
            type={type}
            id={id}
            className={cn(
              'flex h-11 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm transition-all duration-200',
              'placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              error && 'border-error focus:border-error focus:ring-error/20',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
