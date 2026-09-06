'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import {
  createBusinessDocumentUploadPath,
  submitBusinessDocument,
} from '@/app/(business)/documents/actions';

const TYPES = [
  { value: 'trade_certification', label: 'Trade certification' },
  { value: 'business_license', label: 'Business license' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'proof_of_business', label: 'Proof of business' },
];

type Outcome = { kind: 'idle' } | { kind: 'done' } | { kind: 'error'; message: string };

async function uploadAndSubmit(
  file: File,
  documentType: string,
  label: string,
  expiresOn: string,
): Promise<Outcome> {
  const target = await createBusinessDocumentUploadPath();
  if (!target.ok) return { kind: 'error', message: target.message };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const upload = await supabase.storage
    .from('business-documents')
    .upload(target.path, file, { upsert: false });

  if (upload.error) {
    return { kind: 'error', message: 'That file could not be uploaded. Please try again.' };
  }

  const result = await submitBusinessDocument({
    documentType,
    label,
    documentPath: target.path,
    expiresOn: expiresOn === '' ? undefined : expiresOn,
  });
  return result.ok ? { kind: 'done' } : { kind: 'error', message: result.message };
}

/** Lets a business put a credential on file — the platform-credibility half of verification. */
export function BusinessDocumentUpload() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const file = formData.get('document');
    if (!(file instanceof File) || file.size === 0) {
      setOutcome({ kind: 'error', message: 'Choose a document to upload.' });
      return;
    }
    const documentType = String(formData.get('documentType') ?? '');
    const label = String(formData.get('label') ?? '');
    const expiresOn = String(formData.get('expiresOn') ?? '');

    startTransition(async () => {
      const result = await uploadAndSubmit(file, documentType, label, expiresOn);
      setOutcome(result);
      if (result.kind === 'done') router.refresh();
    });
  }

  if (outcome.kind === 'done') {
    return <SuccessState title="Document added" detail="It now appears in your credentials list." />;
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="That document was not recorded" whatToDo={outcome.message} />
      ) : null}
      <UploadFields />
      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Add document'}
      </Button>
    </form>
  );
}

function UploadFields() {
  return (
    <>
      <Field label="Type" htmlFor="documentType">
        <Select id="documentType" name="documentType" defaultValue={TYPES[0]!.value}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Label" htmlFor="label" hint="e.g. “Master Electrician License — State of MI”.">
        <Input id="label" name="label" required minLength={2} maxLength={120} />
      </Field>

      <Field label="Document" htmlFor="document" hint="A photo or PDF.">
        <Input id="document" name="document" type="file" accept="application/pdf,image/*" required />
      </Field>

      <Field label="Expires on (optional)" htmlFor="expiresOn">
        <Input id="expiresOn" name="expiresOn" type="date" />
      </Field>
    </>
  );
}
