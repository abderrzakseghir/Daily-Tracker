import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
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
        <textarea
          id={id}
          className={cn(
            'flex min-h-[100px] w-full rounded-xl border border-border bg-card px-4 py-3 text-sm transition-all duration-200',
            'placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
            error && 'border-error focus:border-error focus:ring-error/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
