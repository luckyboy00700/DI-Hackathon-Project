'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import { createCertificationUploadPath, submitCertification } from '@/app/(org)/verification/actions';

type Outcome = { kind: 'idle' } | { kind: 'done' } | { kind: 'error'; message: string };

async function uploadAndSubmit(file: File, note: string): Promise<Outcome> {
  const target = await createCertificationUploadPath();
  if (!target.ok) return { kind: 'error', message: target.message };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const upload = await supabase.storage
    .from('organization-certifications')
    .upload(target.path, file, { upsert: false });

  if (upload.error) {
    return { kind: 'error', message: 'That file could not be uploaded. Please try again.' };
  }

  const result = await submitCertification({
    documentPath: target.path,
    note: note === '' ? undefined : note,
  });
  return result.ok ? { kind: 'done' } : { kind: 'error', message: result.message };
}

/**
 * Lets an organization put its own identity on file: a certification document (registration,
 * tax-exemption letter, or similar) another organization can open and review. Submitting does
 * not itself grant verified status — only a peer organization's decision does.
 */
export function CertificationUpload() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const file = formData.get('document');
    if (!(file instanceof File) || file.size === 0) {
      setOutcome({ kind: 'error', message: 'Choose a certification document to upload.' });
      return;
    }
    const note = String(formData.get('note') ?? '');

    startTransition(async () => {
      const result = await uploadAndSubmit(file, note);
      setOutcome(result);
      if (result.kind === 'done') router.refresh();
    });
  }

  if (outcome.kind === 'done') {
    return (
      <SuccessState
        title="Certification submitted"
        detail="A verified organization can now review it. You will stay unverified until one does."
      />
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="That certification was not recorded" whatToDo={outcome.message} />
      ) : null}

      <Field
        label="Certification document"
        htmlFor="document"
        hint="Registration, tax-exemption letter, or similar proof of who you are. A photo or PDF."
      >
        <Input id="document" name="document" type="file" accept="application/pdf,image/*" required />
      </Field>

      <Field label="Note (optional)" htmlFor="note" hint="Anything a reviewer should know.">
        <Textarea id="note" name="note" maxLength={500} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Submit certification'}
      </Button>
    </form>
  );
}
