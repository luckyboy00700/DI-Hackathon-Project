'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { notify } from '@/lib/notifications';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

const decisionInput = z.object({
  businessId: z.string().uuid(),
  decision: z.enum(['verified', 'revoked']),
});

/**
 * T024 / T027 — FR-003, FR-023, FR-024.
 * Delegates to record_verification_decision(), which updates status, records who decided and
 * when, withdraws live placements on revoke, and writes the audit row — all in one transaction.
 */
export async function recordVerificationDecision(
  raw: unknown,
): Promise<ActionResult<{ businessId: string; decision: string }>> {
  const parsed = decisionInput.safeParse(raw);
  if (!parsed.success) return fail('INVALID_INPUT');

  try {
    const actor = await requireSessionUser('organization');
    const supabase = await getServerClient();

    const { error } = await supabase.rpc('record_verification_decision', {
      p_business: parsed.data.businessId,
      p_actor: actor.id,
      p_decision: parsed.data.decision,
    });
    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    if (parsed.data.decision === 'revoked') {
      await notifyAffectedApplicants(supabase, parsed.data.businessId);
    }

    revalidatePath('/verification');
    return { ok: true, businessId: parsed.data.businessId, decision: parsed.data.decision };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/** Edge case: applicants to a de-verified business's live placements must be told (FR-024). */
async function notifyAffectedApplicants(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  businessId: string,
): Promise<void> {
  const { data: business } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', businessId)
    .maybeSingle();

  const { data: affected } = await supabase
    .from('applications')
    .select('apprentice_id, placements!inner(business_id)')
    .eq('placements.business_id', businessId)
    .in('status', ['submitted', 'under_review', 'accepted']);

  for (const row of affected ?? []) {
    await notify(
      supabase,
      { profileId: row.apprentice_id as string, email: null },
      { kind: 'business_deverified', businessName: (business?.display_name as string) ?? 'A business' },
    );
  }
}
