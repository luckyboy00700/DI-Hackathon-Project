'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { endorseInput } from '@/lib/validation/schemas';
import { checkEndorsement } from '@/lib/domain/endorsement';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/**
 * T077 / FR-004, FR-005. The domain check gives a precise, plain-language refusal; the RLS
 * policy in 0020 independently refuses the same thing, so this is a better message rather than
 * the only guard (Principle V).
 */
export async function endorse(
  raw: unknown,
): Promise<ActionResult<{ endorsementId: string }>> {
  const parsed = endorseInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('organization');
    const supabase = await getServerClient();
    const { subjectType, subjectId } = parsed.data;

    const { data: operated } = await supabase
      .from('organization_operated_businesses')
      .select('business_id')
      .eq('organization_id', user.id);

    const verdict = checkEndorsement({
      organizationId: user.id,
      subjectType,
      subjectId,
      operatedBusinessIds: ((operated ?? []) as Array<{ business_id: string }>).map(
        (row) => row.business_id,
      ),
    });
    if (!verdict.allowed) return fail('SELF_ENDORSEMENT_REJECTED');

    const { data, error } = await supabase
      .from('endorsements')
      .insert({
        organization_id: user.id,
        subject_type: subjectType,
        apprentice_subject_id: subjectType === 'apprentice' ? subjectId : null,
        business_subject_id: subjectType === 'business' ? subjectId : null,
      })
      .select('id')
      .single();

    if (error) {
      if (/row-level security/i.test(error.message)) return fail('SELF_ENDORSEMENT_REJECTED');
      if (/duplicate key/i.test(error.message)) {
        return fail('INVALID_INPUT', 'You have already endorsed this member.');
      }
      return fail(toErrorCode(new Error(error.message)), error.message);
    }

    revalidatePath('/endorsements');
    return { ok: true, endorsementId: data.id as string };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
