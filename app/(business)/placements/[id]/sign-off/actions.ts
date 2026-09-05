'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { signCompetencyInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

/**
 * T069 / FR-019, FR-022, FR-023. The active-placement and mentor-only rules are RLS policies
 * (0016); a rejection surfaces here as a policy violation, which we translate to plain language.
 */
export async function signCompetency(
  raw: unknown,
): Promise<ActionResult<{ competencyEntryId: string; signedAt: string }>> {
  const parsed = signCompetencyInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('business');
    const supabase = await getServerClient();

    const { data: application } = await supabase
      .from('applications')
      .select('placement_id')
      .eq('id', parsed.data.applicationId)
      .maybeSingle();
    if (!application) return fail('APPLICATION_NOT_FOUND');

    const { data: active } = await supabase.rpc('application_is_active', {
      p_application: parsed.data.applicationId,
    });
    if (!active) return fail('PLACEMENT_NOT_ACTIVE');

    const { data, error } = await supabase
      .from('competency_entries')
      .insert({
        application_id: parsed.data.applicationId,
        placement_id: application.placement_id as string,
        mentor_id: user.id,
        competency: parsed.data.competency,
      })
      .select('id, signed_at')
      .single();

    if (error) {
      const code = /row-level security/i.test(error.message)
        ? 'NOT_PLACEMENT_MENTOR'
        : toErrorCode(new Error(error.message));
      return fail(code, error.message);
    }

    await supabase.rpc('write_audit', {
      p_actor: user.id,
      p_subject_type: 'competency_entry',
      p_subject_id: data.id as string,
      p_action: 'competency_signed',
    });

    revalidatePath('/passport');
    return { ok: true, competencyEntryId: data.id as string, signedAt: data.signed_at as string };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
