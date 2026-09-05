'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { recordGuardianConsentInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/**
 * T056 / FR-014. The signed document is uploaded to the private guardian-consents bucket first;
 * this action records the artifact against the application. Acceptance stays blocked in the
 * database until this row exists (accept_application checks it), so this is a record, not a gate.
 */
export async function recordGuardianConsent(
  raw: unknown,
): Promise<ActionResult<{ consentId: string; recordedAt: string }>> {
  const parsed = recordGuardianConsentInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('apprentice');
    const supabase = await getServerClient();

    const { data: needsConsent, error: checkError } = await supabase.rpc(
      'application_needs_guardian_consent',
      { p_application: parsed.data.applicationId },
    );
    if (checkError) return fail(toErrorCode(new Error(checkError.message)));
    if (!needsConsent) return fail('NOT_A_MINOR_APPLICATION');

    const { data, error } = await supabase
      .from('guardian_consents')
      .insert({
        application_id: parsed.data.applicationId,
        document_path: parsed.data.documentPath,
        recorded_by: user.id,
      })
      .select('id, recorded_at')
      .single();

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    revalidatePath('/applications');
    return { ok: true, consentId: data.id as string, recordedAt: data.recorded_at as string };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/** Creates a short-lived upload target inside the private bucket, scoped to the caller's folder. */
export async function createConsentUploadPath(): Promise<ActionResult<{ path: string }>> {
  try {
    const user = await requireSessionUser('apprentice');
    return { ok: true, path: `${user.id}/${crypto.randomUUID()}.pdf` };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
