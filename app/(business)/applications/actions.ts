'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { decideApplicationInput } from '@/lib/validation/schemas';
import { buildAgreement } from '@/lib/domain/agreement';
import { notify } from '@/lib/notifications';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';
import type { AgeRestrictionCategory } from '@/lib/validation/enums';

type DecideResult = ActionResult<{
  applicationId: string;
  status: 'accepted' | 'declined';
  agreementId?: string;
}>;

/**
 * T057 / FR-016, FR-017, FR-023. Acceptance delegates to accept_application(), which holds the
 * row lock, re-checks consent and capacity, writes the agreement and the audit row in one
 * transaction. Declines take the audited path too — FR-023 covers every status transition.
 */
export async function decideApplication(raw: unknown): Promise<DecideResult> {
  const parsed = decideApplicationInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('business');
    const supabase = await getServerClient();
    const { applicationId, decision } = parsed.data;

    if (decision === 'declined') {
      const { error } = await supabase.rpc('decline_application', {
        p_application: applicationId,
        p_actor: user.id,
      });
      if (error) return fail(toErrorCode(new Error(error.message)), error.message);
      await notifyApprentice(supabase, applicationId, 'declined');
      revalidatePath('/applications');
      return { ok: true, applicationId, status: 'declined' };
    }

    const context = await loadAgreementContext(supabase, applicationId);
    if (!context) return fail('APPLICATION_NOT_FOUND');

    const agreement = buildAgreement(context);

    const { data, error } = await supabase.rpc('accept_application', {
      p_application: applicationId,
      p_actor: user.id,
      p_agreement: agreement,
    });
    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    await notifyApprentice(supabase, applicationId, 'accepted');
    revalidatePath('/applications');
    return { ok: true, applicationId, status: 'accepted', agreementId: data as string };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

/**
 * Assembles the inputs buildAgreement needs. The minor check comes from the security-definer
 * function rather than by reading date_of_birth: a mentor is never handed an applicant's
 * birth date (Principle VI), and this reuses the one SQL definition of "minor at start date".
 */
async function loadAgreementContext(supabase: Supabase, applicationId: string) {
  const { data } = await supabase
    .from('applications')
    .select(
      `apprentice_id,
       placements!inner(trade_category, duration_weeks, weekly_hours, hourly_rate,
         start_window_start, age_restriction_category, required_certifications)`,
    )
    .eq('id', applicationId)
    .maybeSingle();
  if (!data) return null;

  const { data: isMinor } = await supabase.rpc('application_needs_guardian_consent', {
    p_application: applicationId,
  });

  const placement = data.placements as unknown as {
    trade_category: string;
    duration_weeks: number;
    weekly_hours: number;
    hourly_rate: number;
    start_window_start: string;
    age_restriction_category: AgeRestrictionCategory;
    required_certifications: string[];
  };
  return {
    tradeCategory: placement.trade_category,
    durationWeeks: placement.duration_weeks,
    weeklyHours: placement.weekly_hours,
    hourlyRate: Number(placement.hourly_rate),
    startDate: placement.start_window_start,
    ageRestrictionCategory: placement.age_restriction_category,
    requiredCertifications: placement.required_certifications ?? [],
    apprenticeIsMinor: Boolean(isMinor),
  };
}

async function notifyApprentice(
  supabase: Supabase,
  applicationId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const { data } = await supabase
    .from('applications')
    .select('apprentice_id, placements!inner(trade_category)')
    .eq('id', applicationId)
    .maybeSingle();
  if (!data) return;

  const placement = data.placements as unknown as { trade_category: string };
  const placementTitle = placement.trade_category.replace(/_/g, ' ');
  const recipient = { profileId: data.apprentice_id as string, email: null };

  await notify(supabase, recipient, { kind: 'application_status_changed', status, placementTitle });
  if (status === 'accepted') {
    await notify(supabase, recipient, { kind: 'agreement_generated', placementTitle });
  }
}
