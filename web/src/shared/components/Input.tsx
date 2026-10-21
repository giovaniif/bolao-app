import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-muted)]">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${className}`}
          {...props}
        />
      </div>
    );
  }
);
