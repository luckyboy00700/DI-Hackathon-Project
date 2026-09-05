'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { submitApplicationInput, withdrawApplicationInput } from '@/lib/validation/schemas';
import { notify } from '@/lib/notifications';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/** T055 / FR-012, FR-013. The duplicate guard is the unique index, surfaced here as a message. */
export async function submitApplication(
  raw: unknown,
): Promise<ActionResult<{ applicationId: string; status: 'submitted' }>> {
  const parsed = submitApplicationInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('apprentice');
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('applications')
      .insert({
        placement_id: parsed.data.placementId,
        apprentice_id: user.id,
        availability: parsed.data.availability,
        experience: parsed.data.experience,
        statement: parsed.data.statement,
      })
      .select('id')
      .single();

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    revalidatePath('/applications');
    return { ok: true, applicationId: data.id as string, status: 'submitted' };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/**
 * T058 / FR-018. One action serves both parties: withdraw_application() authorizes the caller as
 * either the apprentice or the owning business, so the same entry point covers an apprentice
 * withdrawal and a business termination, distinguished by reason category.
 */
export async function withdrawApplication(
  raw: unknown,
): Promise<ActionResult<{ applicationId: string; status: 'withdrawn'; capacityReleased: boolean }>> {
  const parsed = withdrawApplicationInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser();
    const supabase = await getServerClient();

    const { data, error } = await supabase.rpc('withdraw_application', {
      p_application: parsed.data.applicationId,
      p_actor: user.id,
      p_reason: parsed.data.reasonCategory,
    });
    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    await notifyBothParties(supabase, parsed.data.applicationId, parsed.data.reasonCategory);

    revalidatePath('/applications');
    return {
      ok: true,
      applicationId: parsed.data.applicationId,
      status: 'withdrawn',
      capacityReleased: Boolean(data),
    };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

async function notifyBothParties(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  applicationId: string,
  reasonCategory: string,
): Promise<void> {
  const { data } = await supabase
    .from('applications')
    .select('apprentice_id, placements!inner(business_id, trade_category)')
    .eq('id', applicationId)
    .maybeSingle();
  if (!data) return;

  const placement = data.placements as unknown as { business_id: string; trade_category: string };
  for (const profileId of [data.apprentice_id as string, placement.business_id]) {
    await notify(
      supabase,
      { profileId, email: null },
      {
        kind: 'application_withdrawn',
        placementTitle: placement.trade_category.replace(/_/g, ' '),
        reasonCategory,
      },
    );
  }
}
