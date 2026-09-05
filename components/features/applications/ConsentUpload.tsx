'use client';

import { useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import {
  createConsentUploadPath,
  recordGuardianConsent,
} from '@/app/(apprentice)/applications/consent-actions';

type Outcome = { kind: 'idle' } | { kind: 'done' } | { kind: 'error'; message: string };

async function uploadAndRecord(applicationId: string, file: File): Promise<Outcome> {
  const target = await createConsentUploadPath();
  if (!target.ok) return { kind: 'error', message: target.message };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const upload = await supabase.storage
    .from('guardian-consents')
    .upload(target.path, file, { upsert: false });

  if (upload.error) {
    return { kind: 'error', message: 'That file could not be uploaded. Please try again.' };
  }

  const result = await recordGuardianConsent({ applicationId, documentPath: target.path });
  return result.ok ? { kind: 'done' } : { kind: 'error', message: result.message };
}

/**
 * T060 / FR-014. Uploads the signed consent document to a private bucket, then records it
 * against the application. The mentor cannot accept until this exists.
 */
export function ConsentUpload({ applicationId }: { applicationId: string }) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const file = formData.get('document');
    if (!(file instanceof File) || file.size === 0) {
      setOutcome({ kind: 'error', message: 'Choose the signed consent document to upload.' });
      return;
    }

    startTransition(async () => {
      setOutcome(await uploadAndRecord(applicationId, file));
    });
  }

  if (outcome.kind === 'done') {
    return (
      <SuccessState
        title="Guardian consent recorded"
        detail="The mentor can now accept this application. The document itself stays private."
      />
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="Consent was not recorded" whatToDo={outcome.message} />
      ) : null}

      <Field
        label="Signed guardian consent document"
        htmlFor="document"
        hint="A photo or PDF of the signed form. Only you and the mentor can see it."
      >
        <Input id="document" name="document" type="file" accept="application/pdf,image/*" required />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Record consent'}
      </Button>
    </form>
  );
}
