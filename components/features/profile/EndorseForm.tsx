'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import { endorse } from '@/app/(org)/endorsements/actions';

export type Candidate = { id: string; name: string; subjectType: 'apprentice' | 'business' };

/**
 * T078 — the endorse control. Deliberately offers only "who": there is no free-text box,
 * because FR-005 forbids storing a character assessment about a person.
 */
export function EndorseForm({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const candidate = candidates.find((c) => c.id === String(formData.get('subject') ?? ''));
    if (!candidate) {
      setError('Choose someone to vouch for.');
      setBusy(false);
      return;
    }

    const result = await endorse({ subjectType: candidate.subjectType, subjectId: candidate.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSigned(candidate.name);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error ? <ErrorState title="That endorsement was not recorded" whatToDo={error} /> : null}
      {signed ? (
        <SuccessState
          title={`You vouched for ${signed}`}
          detail="Your organization now appears as a named reference. Nothing you typed about them is stored, because nothing was asked."
        />
      ) : null}
      <SubjectField candidates={candidates} />
      <Button type="submit" disabled={busy}>
        {busy ? 'Recording…' : 'Vouch for this member'}
      </Button>
    </form>
  );
}

function SubjectField({ candidates }: { candidates: Candidate[] }) {
  return (
    <Field
      label="Who are you vouching for?"
      htmlFor="subject"
      hint="Your organization's name is recorded as the reference, along with the date."
    >
      <Select id="subject" name="subject" required defaultValue="">
        <option value="" disabled>
          Choose a member
        </option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name} ({candidate.subjectType})
          </option>
        ))}
      </Select>
    </Field>
  );
}
