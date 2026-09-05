'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/features/states';
import { decideApplication } from '@/app/(business)/applications/actions';

/**
 * T061 — accept / decline controls.
 *
 * The mutation is awaited in a plain handler, NOT inside startTransition: React may re-run a
 * transition callback, and re-running an accept is not a harmless retry — it silently accepted
 * an application whose first attempt had been correctly refused for missing guardian consent.
 *
 * Success is confirmed by the refreshed row (its badge flips and these buttons disappear) rather
 * than by local state, which the refresh would discard anyway.
 */
export function DecideButtons({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'accepted' | 'declined') {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await decideApplication({ applicationId, decision });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Could not record that decision" whatToDo={error} /> : null}
      <div className="flex gap-2">
        <Button onClick={() => void decide('accepted')} disabled={busy}>
          {busy ? 'Working…' : 'Accept'}
        </Button>
        <Button variant="secondary" onClick={() => void decide('declined')} disabled={busy}>
          Decline
        </Button>
      </div>
    </div>
  );
}
