'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { ErrorState } from '@/components/features/states';
import { withdrawApplication } from '@/app/(apprentice)/applications/actions';

/**
 * T063 / FR-018. Used from both the apprentice's and the mentor's view of an application; the
 * database authorizes whichever party is calling, so one control serves both.
 */
const REASONS = {
  apprentice: [
    { value: 'apprentice_withdrew', label: 'I can no longer take this placement' },
    { value: 'mutual', label: 'We agreed together to end it' },
    { value: 'other', label: 'Another reason' },
  ],
  business: [
    { value: 'business_terminated', label: 'We are ending this placement' },
    { value: 'mutual', label: 'We agreed together to end it' },
    { value: 'other', label: 'Another reason' },
  ],
} as const;

export function WithdrawButton({
  applicationId,
  actor,
}: {
  applicationId: string;
  actor: 'apprentice' | 'business';
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasons = REASONS[actor];

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await withdrawApplication({
        applicationId,
        reasonCategory: formData.get('reasonCategory'),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {actor === 'apprentice' ? 'Withdraw my application' : 'End this placement'}
      </Button>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      {error ? <ErrorState title="Could not record that" whatToDo={error} /> : null}
      <ReasonField applicationId={applicationId} reasons={reasons} />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? 'Recording…' : 'Confirm'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReasonField({
  applicationId,
  reasons,
}: {
  applicationId: string;
  reasons: readonly { value: string; label: string }[];
}) {
  return (
    <Field
      label="Reason"
      htmlFor={`reason-${applicationId}`}
      hint="This is recorded with a timestamp. The other party is told the placement ended, not the details."
    >
      <Select id={`reason-${applicationId}`} name="reasonCategory" required>
        {reasons.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
