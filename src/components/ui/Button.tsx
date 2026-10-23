import type { ComponentPropsWithRef } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'expense' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy-800 text-white hover:bg-navy-900',
  secondary: 'border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  success: 'bg-blue-700 text-white hover:bg-blue-800',
  expense: 'bg-indigo-600 text-white hover:bg-indigo-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-700 hover:bg-slate-100',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

/** Shared button styles, also used on <Link> elements that look like buttons. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(' ');
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
