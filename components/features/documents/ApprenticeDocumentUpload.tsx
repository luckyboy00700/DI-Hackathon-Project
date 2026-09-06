'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ErrorState, SuccessState } from '@/components/features/states';
import {
  createApprenticeDocumentUploadPath,
  submitApprenticeDocument,
} from '@/app/(apprentice)/documents/actions';

const TYPES = [
  { value: 'liability_waiver', label: 'Liability waiver' },
  { value: 'volunteer_hours_log', label: 'Volunteer hours log' },
];

type Outcome = { kind: 'idle' } | { kind: 'done' } | { kind: 'error'; message: string };

async function uploadAndSubmit(file: File, documentType: string, note: string): Promise<Outcome> {
  const target = await createApprenticeDocumentUploadPath();
  if (!target.ok) return { kind: 'error', message: target.message };

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const upload = await supabase.storage
    .from('apprentice-documents')
    .upload(target.path, file, { upsert: false });

  if (upload.error) {
    return { kind: 'error', message: 'That file could not be uploaded. Please try again.' };
  }

  const result = await submitApprenticeDocument({
    documentType,
    documentPath: target.path,
    note: note === '' ? undefined : note,
  });
  return result.ok ? { kind: 'done' } : { kind: 'error', message: result.message };
}

/** Liability waivers and volunteer hour logs. Guardian consent has its own flow (per application). */
export function ApprenticeDocumentUpload() {
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
    const note = String(formData.get('note') ?? '');

    startTransition(async () => {
      const result = await uploadAndSubmit(file, documentType, note);
      setOutcome(result);
      if (result.kind === 'done') router.refresh();
    });
  }

  if (outcome.kind === 'done') {
    return <SuccessState title="Document added" detail="It now appears in your documents list." />;
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {outcome.kind === 'error' ? (
        <ErrorState title="That document was not recorded" whatToDo={outcome.message} />
      ) : null}

      <Field label="Type" htmlFor="documentType">
        <Select id="documentType" name="documentType" defaultValue={TYPES[0]!.value}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Document" htmlFor="document" hint="A photo or PDF.">
        <Input id="document" name="document" type="file" accept="application/pdf,image/*" required />
      </Field>

      <Field label="Note (optional)" htmlFor="note">
        <Textarea id="note" name="note" maxLength={500} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Add document'}
      </Button>
    </form>
  );
}
