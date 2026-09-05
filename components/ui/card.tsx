import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-(--radius-card) border border-border bg-surface p-4 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = 'neutral' | 'success' | 'danger' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-surface text-success',
  danger: 'bg-danger-surface text-danger',
  warning: 'bg-warning-surface text-warning',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-(--radius-control) px-2 py-1 text-sm font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
