import { describe, expect, it } from 'vitest';
import { searchPlacementsInput } from '@/lib/validation/schemas';

/** T030 — contract test for searchPlacements (contracts/server-actions.md). */

describe('searchPlacements input contract', () => {
  it('accepts a minimal search with only a radius', () => {
    const parsed = searchPlacementsInput.safeParse({ distanceKm: 25 });
    expect(parsed.success).toBe(true);
    // Pagination defaults to page 1; the action always paginates server-side (Principle IV).
    expect(parsed.success && parsed.data.page).toBe(1);
  });

  it('accepts the full filter set from FR-008', () => {
    const parsed = searchPlacementsInput.safeParse({
      distanceKm: 15,
      tradeCategory: 'electrical',
      minWeeks: 8,
      maxWeeks: 12,
      minWeeklyHours: 15,
      maxWeeklyHours: 25,
      startAfter: '2026-06-01',
      startBefore: '2026-07-01',
      page: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-positive or absurd radius', () => {
    expect(searchPlacementsInput.safeParse({ distanceKm: 0 }).success).toBe(false);
    expect(searchPlacementsInput.safeParse({ distanceKm: -5 }).success).toBe(false);
    expect(searchPlacementsInput.safeParse({ distanceKm: 5000 }).success).toBe(false);
  });

  it('rejects an unknown trade category', () => {
    expect(
      searchPlacementsInput.safeParse({ distanceKm: 25, tradeCategory: 'cryptomining' }).success,
    ).toBe(false);
  });

  it('rejects a malformed start-window date', () => {
    expect(
      searchPlacementsInput.safeParse({ distanceKm: 25, startAfter: 'next tuesday' }).success,
    ).toBe(false);
  });

  it('rejects a page below 1', () => {
    expect(searchPlacementsInput.safeParse({ distanceKm: 25, page: 0 }).success).toBe(false);
  });

  it('takes no applicant identity as input — the viewer is resolved server-side', () => {
    // FR-010 is enforced against the session's own date of birth. If the client could pass an
    // age or an apprentice id, age gating would be client-controlled, which is a blocking defect.
    const parsed = searchPlacementsInput.safeParse({ distanceKm: 25, apprenticeId: 'anything' });
    expect(parsed.success && 'apprenticeId' in parsed.data).toBe(false);
  });
});
