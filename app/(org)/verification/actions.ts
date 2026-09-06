'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import {
  decideOrganizationVerificationInput,
  submitOrganizationCertificationInput,
} from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/** Creates an upload target inside the private bucket, scoped to the caller's own folder. */
export async function createCertificationUploadPath(): Promise<ActionResult<{ path: string }>> {
  try {
    const user = await requireSessionUser('organization');
    return { ok: true, path: `${user.id}/${crypto.randomUUID()}.pdf` };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/**
 * Records a certification document the organization already uploaded to the private bucket.
 * This does not itself verify anything — it puts a claim on file for a peer organization to
 * review (Principle V: the client never sets its own verification status).
 *
 * TODO: automated document-recognition review is not wired up yet. Until it is, every
 * submission is refused here rather than silently recorded as if it had been checked.
 */
export async function submitCertification(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = submitOrganizationCertificationInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    await requireSessionUser('organization');
    return fail('INCORRECT_DOCUMENTATION');
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/**
 * A verified organization's decision on another organization's certification. Delegates to
 * record_organization_verification_decision(), which checks the actor is itself verified and
 * writes the audit row in the same transaction.
 */
export async function decideOrganizationVerification(
  raw: unknown,
): Promise<ActionResult<{ organizationId: string; decision: string }>> {
  const parsed = decideOrganizationVerificationInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT');

  try {
    const actor = await requireSessionUser('organization');
    const supabase = await getServerClient();

    const { error } = await supabase.rpc('record_organization_verification_decision', {
      p_organization: parsed.data.organizationId,
      p_actor: actor.id,
      p_decision: parsed.data.decision,
    });
    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    revalidatePath('/verification');
    return {
      ok: true,
      organizationId: parsed.data.organizationId,
      decision: parsed.data.decision,
    };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
