import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

/**
 * Every state is designed, not defaulted (constitution Principle III).
 * A screen that can render blank with no explanation is incomplete.
 */

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 p-4">
      <p className="text-base text-muted-foreground">{label}</p>
      <div className="h-2 w-32 animate-pulse rounded-(--radius-control) bg-muted" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-start gap-3 text-left">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-base text-muted-foreground">{description}</p>
      {action}
    </Card>
  );
}

/**
 * Errors are actionable, plain language, never raw exception text or a bare code.
 * The live-region role lives on the container, so the <h2> keeps its heading semantics —
 * putting role="alert" on the heading itself would strip it from the document outline.
 */
export function ErrorState({ title, whatToDo }: { title: string; whatToDo: string }) {
  return (
    <div role="alert">
      <Card className="flex flex-col gap-2 border-danger bg-danger-surface">
        <h2 className="text-lg font-semibold text-danger">{title}</h2>
        <p className="text-base text-foreground">{whatToDo}</p>
      </Card>
    </div>
  );
}

export function SuccessState({ title, detail }: { title: string; detail: string }) {
  return (
    <div role="status">
      <Card className="flex flex-col gap-2 border-success bg-success-surface">
        <h2 className="text-lg font-semibold text-success">{title}</h2>
        <p className="text-base text-foreground">{detail}</p>
      </Card>
    </div>
  );
}
