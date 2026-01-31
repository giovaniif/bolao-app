import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({
  className = '',
  variant = 'primary',
  children,
  ...props
}: ButtonProps) {
  const base =
    'px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white',
    secondary: 'bg-[var(--color-card)] border border-slate-600 text-slate-200',
    ghost: 'hover:bg-slate-700/50 text-slate-200',
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
