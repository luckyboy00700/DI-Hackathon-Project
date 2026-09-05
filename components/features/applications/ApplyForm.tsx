'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import { submitApplication } from '@/app/(apprentice)/applications/actions';

/** T059 / FR-012. */
export function ApplyForm({ placementId }: { placementId: string }) {
  const [outcome, setOutcome] = useState<
    { kind: 'idle' } | { kind: 'sent' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await submitApplication({
        placementId,
        availability: formData.get('availability'),
        experience: formData.get('experience') ?? '',
        statement: formData.get('statement'),
      });
      setOutcome(result.ok ? { kind: 'sent' } : { kind: 'error', message: result.message });
    });
  }

  if (outcome.kind === 'sent') {
    return (
      <SuccessState
        title="Application sent"
        detail="The mentor will review it. If you are under 18, upload your guardian's signed consent next — it must be on file before they can accept you."
      />
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="Your application was not sent" whatToDo={outcome.message} />
      ) : null}
      <ApplyFields />
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send application'}
      </Button>
    </form>
  );
}

function ApplyFields() {
  return (
    <>
      <Field
        label="When you are available"
        htmlFor="availability"
        hint="For example: weekday mornings from mid-June."
      >
        <Input id="availability" name="availability" required minLength={3} maxLength={500} />
      </Field>

      <Field
        label="Any relevant experience"
        htmlFor="experience"
        hint="Optional. School shop class, helping family, anything hands-on."
      >
        <Textarea id="experience" name="experience" maxLength={2000} />
      </Field>

      <Field label="Why you want this placement" htmlFor="statement" hint="A few sentences is plenty.">
        <Textarea id="statement" name="statement" required minLength={10} maxLength={2000} />
      </Field>
    </>
  );
}
