'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/features/states';
import { deleteBusinessDocument } from '@/app/(business)/documents/actions';

export type BusinessDocumentRow = {
  id: string;
  documentType: string;
  label: string;
  expiresOn: string | null;
  uploadedAt: string;
};

const label = (value: string) => value.replace(/_/g, ' ');

function expiryTone(expiresOn: string | null): 'success' | 'warning' | 'danger' | null {
  if (!expiresOn) return null;
  const days = (new Date(expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return 'danger';
  if (days < 30) return 'warning';
  return 'success';
}

export function BusinessDocumentList({ rows }: { rows: BusinessDocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No credentials on file"
        description="Trade certifications, licenses, insurance, and proof of business all help establish trust."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <DocumentCard row={row} />
        </li>
      ))}
    </ul>
  );
}

function DocumentCard({ row }: { row: BusinessDocumentRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tone = expiryTone(row.expiresOn);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{row.label}</h3>
        <Badge>{label(row.documentType)}</Badge>
        {tone ? (
          <Badge tone={tone}>
            {tone === 'danger' ? 'Expired' : `Expires ${row.expiresOn}`}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Added {new Date(row.uploadedAt).toLocaleDateString()}
      </p>
      <Button
        variant="secondary"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteBusinessDocument({ id: row.id });
            router.refresh();
          })
        }
      >
        {pending ? 'Removing…' : 'Remove'}
      </Button>
    </Card>
  );
}
