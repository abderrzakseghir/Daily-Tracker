import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Sélectionner...',
      label,
      error,
      className,
      disabled,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const id = React.useId();

    const selectedOption = options.find((opt) => opt.value === value);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="w-full" ref={containerRef}>
        {label && (
          <label
            htmlFor={id}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <button
            ref={ref}
            id={id}
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-2 text-sm transition-all duration-200',
              'hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-error focus:border-error focus:ring-error/20',
              className
            )}
          >
            <span className={cn(!selectedOption && 'text-muted')}>
              {selectedOption ? (
                <span className="flex items-center gap-2">
                  {selectedOption.icon}
                  {selectedOption.label}
                </span>
              ) : (
                placeholder
              )}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card animate-fade-in">
              <div className="max-h-60 overflow-auto py-1">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange?.(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors',
                      'hover:bg-muted/10',
                      option.value === value &&
                        'bg-accent/10 text-accent font-medium'
                    )}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
