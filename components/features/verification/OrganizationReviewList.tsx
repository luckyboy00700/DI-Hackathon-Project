'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/features/states';
import { decideOrganizationVerification } from '@/app/(org)/verification/actions';

export type PendingOrganization = {
  organizationId: string;
  displayName: string;
  note: string | null;
  documentUrl: string | null;
};

/** Lets a verified organization approve or reject another organization's certification. */
export function OrganizationReviewList({ organizations }: { organizations: PendingOrganization[] }) {
  if (organizations.length === 0) {
    return (
      <EmptyState
        title="Nothing to review"
        description="No other organization has a certification on file yet."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {organizations.map((org) => (
        <li key={org.organizationId}>
          <ReviewCard organization={org} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ organization }: { organization: PendingOrganization }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'verified' | 'revoked') {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await decideOrganizationVerification({
      organizationId: organization.organizationId,
      decision,
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{organization.displayName}</h3>
      {organization.note ? (
        <p className="text-base text-muted-foreground">{organization.note}</p>
      ) : null}
      {organization.documentUrl ? (
        <a
          href={organization.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline"
        >
          View certification document
        </a>
      ) : null}
      {error ? <ErrorState title="Could not record that decision" whatToDo={error} /> : null}
      <div className="flex gap-2">
        <Button onClick={() => void decide('verified')} disabled={busy}>
          {busy ? 'Working…' : 'Verify'}
        </Button>
        <Button variant="secondary" onClick={() => void decide('revoked')} disabled={busy}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
