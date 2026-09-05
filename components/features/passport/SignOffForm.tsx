'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import { signCompetency } from '@/app/(business)/placements/[id]/sign-off/actions';

/** T070 — mentor signs a competency the apprentice demonstrated. */
export function SignOffForm({ applicationId }: { applicationId: string }) {
  const [outcome, setOutcome] = useState<
    { kind: 'idle' } | { kind: 'signed'; competency: string } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const competency = String(formData.get('competency') ?? '');
    startTransition(async () => {
      const result = await signCompetency({ applicationId, competency });
      setOutcome(
        result.ok ? { kind: 'signed', competency } : { kind: 'error', message: result.message },
      );
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="That sign-off was not recorded" whatToDo={outcome.message} />
      ) : null}
      {outcome.kind === 'signed' ? (
        <SuccessState
          title="Competency signed"
          detail={`"${outcome.competency}" is now on the apprentice's Skill Passport, attributed to you. It cannot be edited.`}
        />
      ) : null}

      <Field
        label="What did they demonstrate?"
        htmlFor="competency"
        hint="Be specific — this is a permanent, signed record. For example: terminated and tested a lighting circuit."
      >
        <Input id="competency" name="competency" required minLength={3} maxLength={160} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Signing…' : 'Sign off competency'}
      </Button>
    </form>
  );
}
