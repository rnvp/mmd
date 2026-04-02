import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'accent';
type ButtonSize = 'sm' | 'md' | 'icon';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    active?: boolean;
  }
>;

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'border border-[var(--app-border)] bg-[var(--app-button-bg)] text-[var(--app-text)] hover:border-[var(--app-border-hover)] hover:bg-[var(--app-button-bg-hover)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--app-text-soft)] hover:bg-[var(--app-ghost-bg-hover)] hover:text-[var(--app-text-strong)]',
  outline:
    'border border-[var(--app-border-strong)] bg-[var(--app-button-outline-bg)] text-[var(--app-text)] hover:border-[var(--app-border-hover)] hover:bg-[var(--app-button-outline-bg-hover)]',
  accent:
    'border border-[var(--app-accent-border)] bg-[var(--app-accent-bg)] text-[var(--app-accent-text)] hover:border-[var(--app-accent-border-hover)] hover:bg-[var(--app-accent-bg-hover)]'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-9 px-3 text-[13px]',
  icon: 'h-8 w-8 px-0'
};

export function Button({
  className,
  variant = 'default',
  size = 'md',
  active = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        active && 'border-[var(--app-accent-border-hover)] bg-[var(--app-accent-bg-hover)] text-[var(--app-accent-text)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
