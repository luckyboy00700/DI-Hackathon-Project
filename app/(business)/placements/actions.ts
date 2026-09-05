'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/db/client';
import { requireSessionUser } from '@/lib/auth/session';
import { createPlacementInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult, type ErrorCode } from '@/lib/errors';
import { ERROR_MESSAGES } from '@/lib/errors';

type CreatePlacementResult = ActionResult<{
  placementId: string;
  status: 'draft' | 'open';
  draftReason?: string;
}>;

type PlacementInput = ReturnType<typeof createPlacementInput.parse>;

/** coarse_location is intentionally absent: it is filled server-side from the business profile. */
function toRow(input: PlacementInput, businessId: string, publishable: boolean) {
  return {
    business_id: businessId,
    trade_category: input.tradeCategory,
    description: input.description,
    postal_code: input.postalCode,
    region: input.region,
    duration_weeks: input.durationWeeks,
    weekly_hours: input.weeklyHours,
    hourly_rate: input.hourlyRate,
    capacity: input.capacity,
    start_window_start: input.startWindowStart,
    start_window_end: input.startWindowEnd,
    required_certifications: input.requiredCertifications,
    age_restriction_category: input.ageRestrictionCategory,
    status: publishable ? ('open' as const) : ('draft' as const),
  };
}

/**
 * T023 / FR-006, FR-002, FR-007.
 * Input is parsed through the declared schema at the boundary (Principle I) and the actual
 * publish gate lives in RLS + the wage-floor trigger — this action reports, it does not decide.
 */
export async function createPlacement(raw: unknown): Promise<CreatePlacementResult> {
  const parsed = createPlacementInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  try {
    const user = await requireSessionUser('business');
    const supabase = await getServerClient();

    const { data: business } = await supabase
      .from('businesses')
      .select('verification_status')
      .eq('profile_id', user.id)
      .single();

    const publishable = business?.verification_status === 'verified';

    const { data, error } = await supabase
      .from('placements')
      .insert(toRow(parsed.data, user.id, publishable))
      .select('id, status')
      .single();

    if (error) {
      const code: ErrorCode = error.message.includes('RATE_BELOW_WAGE_FLOOR')
        ? 'RATE_BELOW_WAGE_FLOOR'
        : toErrorCode(new Error(error.message));
      return fail(code, error.message);
    }

    revalidatePath('/placements');
    return {
      ok: true,
      placementId: data.id as string,
      status: data.status as 'draft' | 'open',
      // Surfaced so the UI can explain *why* it stayed a draft, in plain language.
      ...(publishable ? {} : { draftReason: ERROR_MESSAGES.BUSINESS_NOT_VERIFIED }),
    };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
