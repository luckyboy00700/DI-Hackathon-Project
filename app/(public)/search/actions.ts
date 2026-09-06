'use server';

import { getServerClient } from '@/lib/db/client';
import { searchPlacementsInput } from '@/lib/validation/schemas';
import { fail, toErrorCode, type ActionResult } from '@/lib/errors';

export type SearchResultRow = {
  placementId: string;
  businessName: string;
  tradeCategory: string;
  distanceKm: number;
  hourlyRate: number;
  weeklyHours: number;
  durationWeeks: number;
  startWindowStart: string;
};

export type MasjidOption = {
  organizationId: string;
  displayName: string;
  distanceKm: number | null;
};

// Not exported: a "use server" module may only export async functions.
const PAGE_SIZE = 20;

/**
 * T035 / FR-008–FR-011. All filtering — verification, open status, age gating, distance — is
 * applied by search_placements() in SQL. This action parses input and shapes output; it makes
 * no eligibility decisions of its own (constitution Principle V).
 */
export async function searchPlacements(
  raw: unknown,
): Promise<ActionResult<{ results: SearchResultRow[]; totalCount: number; page: number }>> {
  const parsed = searchPlacementsInput.safeParse(raw);
  if (!parsed.success) {
    return fail('INVALID_INPUT', parsed.error.issues.map((i) => i.message).join('; '));
  }

  const input = parsed.data;

  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase.rpc('search_placements', {
      p_distance_km: input.distanceKm,
      p_trade: input.tradeCategory ?? null,
      p_min_weeks: input.minWeeks ?? null,
      p_max_weeks: input.maxWeeks ?? null,
      p_min_weekly_hours: input.minWeeklyHours ?? null,
      p_max_weekly_hours: input.maxWeeklyHours ?? null,
      p_start_after: input.startAfter ?? null,
      p_start_before: input.startBefore ?? null,
      p_page: input.page,
      p_page_size: PAGE_SIZE,
      p_organization_id: input.organizationId ?? null,
    });

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      page: input.page,
      totalCount: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
      results: rows.map((row) => ({
        placementId: row.placement_id as string,
        businessName: row.business_name as string,
        tradeCategory: row.trade_category as string,
        distanceKm: Number(row.distance_km),
        hourlyRate: Number(row.hourly_rate),
        weeklyHours: Number(row.weekly_hours),
        durationWeeks: Number(row.duration_weeks),
        startWindowStart: row.start_window_start as string,
      })),
    };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}

/**
 * Local masjids/community hubs with at least one verified business on the board, nearest first.
 * Backs the front-page and browse-page masjid picker so a caller can subset placements to only
 * those routed through a hub they trust.
 */
export async function listMasjidOptions(): Promise<ActionResult<{ options: MasjidOption[] }>> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase.rpc('list_verifying_organizations', {
      p_distance_km: 100,
    });

    if (error) return fail(toErrorCode(new Error(error.message)), error.message);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      options: rows.map((row) => ({
        organizationId: row.organization_id as string,
        displayName: row.display_name as string,
        distanceKm: row.distance_km === null ? null : Number(row.distance_km),
      })),
    };
  } catch (error) {
    return fail(toErrorCode(error));
  }
}
