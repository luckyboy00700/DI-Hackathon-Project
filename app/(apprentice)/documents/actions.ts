'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { submitApprenticeDocumentInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/** Creates an upload target inside the private bucket, scoped to the caller's own folder. */
export async function createApprenticeDocumentUploadPath(): Promise<ActionResult<{ path: string }>> {
  try {
    const user = await requireSessionUser('apprentice');
    return { ok: true, path: `${user.id}/${crypto.randomUUID()}.pdf` };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/** Records a liability waiver or volunteer hour log the apprentice already uploaded. */
export async function submitApprenticeDocument(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = submitApprenticeDocumentInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('apprentice');
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('apprentice_documents')
      .insert({
        apprentice_id: user.id,
        application_id: parsed.data.applicationId ?? null,
        document_type: parsed.data.documentType,
        document_path: parsed.data.documentPath,
        note: parsed.data.note ?? null,
      })
      .select('id')
      .single();

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    revalidatePath('/dashboard');
    return { ok: true, id: data.id as string };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
