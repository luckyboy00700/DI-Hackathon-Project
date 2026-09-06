'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { submitBusinessDocumentInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

const deleteDocumentInput = z.object({ id: z.string().uuid() });

/** Creates an upload target inside the private bucket, scoped to the caller's own folder. */
export async function createBusinessDocumentUploadPath(): Promise<ActionResult<{ path: string }>> {
  try {
    const user = await requireSessionUser('business');
    return { ok: true, path: `${user.id}/${crypto.randomUUID()}.pdf` };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/** Records a credential document the business already uploaded to the private bucket. */
export async function submitBusinessDocument(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = submitBusinessDocumentInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('business');
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('business_documents')
      .insert({
        business_id: user.id,
        document_type: parsed.data.documentType,
        label: parsed.data.label,
        document_path: parsed.data.documentPath,
        expires_on: parsed.data.expiresOn ?? null,
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

/** Removes a document the business no longer wants listed (e.g. it uploaded the wrong file). */
export async function deleteBusinessDocument(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteDocumentInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT');

  try {
    const user = await requireSessionUser('business');
    const supabase = await getServerClient();

    const { error } = await supabase
      .from('business_documents')
      .delete()
      .eq('id', parsed.data.id)
      .eq('business_id', user.id);

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    revalidatePath('/dashboard');
    return { ok: true, id: parsed.data.id };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
