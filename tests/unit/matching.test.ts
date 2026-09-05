import { describe, expect, it } from 'vitest';
import { buildSearchPredicate, rankByProximity, type SearchCandidate } from '@/lib/domain/matching';

/** T029 — written before lib/domain/matching.ts exists (constitution Principle II). */

function candidate(overrides: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    placementId: 'p1',
    distanceKm: 5,
    tradeCategory: 'electrical',
    durationWeeks: 10,
    weeklyHours: 20,
    startDate: '2026-06-15',
    ageRestrictionCategory: 'none',
    businessVerified: true,
    status: 'open',
    ...overrides,
  };
}

describe('buildSearchPredicate', () => {
  const viewer = { dateOfBirth: '2009-01-01' };

  it('accepts a candidate matching every filter', () => {
    const matches = buildSearchPredicate({ distanceKm: 10, tradeCategory: 'electrical' }, viewer);
    expect(matches(candidate())).toBe(true);
  });

  it('excludes placements beyond the requested radius', () => {
    const matches = buildSearchPredicate({ distanceKm: 10 }, viewer);
    expect(matches(candidate({ distanceKm: 10.1 }))).toBe(false);
    expect(matches(candidate({ distanceKm: 10 }))).toBe(true);
  });

  it('excludes a different trade category', () => {
    const matches = buildSearchPredicate({ distanceKm: 50, tradeCategory: 'plumbing' }, viewer);
    expect(matches(candidate({ tradeCategory: 'electrical' }))).toBe(false);
  });

  it('excludes placements from unverified businesses (FR-011)', () => {
    const matches = buildSearchPredicate({ distanceKm: 50 }, viewer);
    expect(matches(candidate({ businessVerified: false }))).toBe(false);
  });

  it('excludes placements that are not open (FR-011)', () => {
    const matches = buildSearchPredicate({ distanceKm: 50 }, viewer);
    expect(matches(candidate({ status: 'draft' }))).toBe(false);
    expect(matches(candidate({ status: 'withdrawn' }))).toBe(false);
  });

  it('excludes age-restricted placements for a minor at the start date (FR-010)', () => {
    const matches = buildSearchPredicate({ distanceKm: 50 }, viewer);
    expect(matches(candidate({ ageRestrictionCategory: 'high_voltage' }))).toBe(false);
  });

  it('keeps age-restricted placements for an applicant who is 18 at the start date', () => {
    const adult = { dateOfBirth: '2005-01-01' };
    const matches = buildSearchPredicate({ distanceKm: 50 }, adult);
    expect(matches(candidate({ ageRestrictionCategory: 'high_voltage' }))).toBe(true);
  });

  it('applies duration, weekly-hours, and start-window filters', () => {
    const matches = buildSearchPredicate(
      {
        distanceKm: 50,
        minWeeks: 8,
        maxWeeks: 12,
        minWeeklyHours: 15,
        maxWeeklyHours: 25,
        startAfter: '2026-06-01',
        startBefore: '2026-07-01',
      },
      viewer,
    );
    expect(matches(candidate())).toBe(true);
    expect(matches(candidate({ durationWeeks: 4 }))).toBe(false);
    expect(matches(candidate({ weeklyHours: 40 }))).toBe(false);
    expect(matches(candidate({ startDate: '2026-05-01' }))).toBe(false);
    expect(matches(candidate({ startDate: '2026-08-01' }))).toBe(false);
  });
});

describe('rankByProximity', () => {
  it('orders nearest first', () => {
    const ranked = rankByProximity([
      candidate({ placementId: 'far', distanceKm: 22 }),
      candidate({ placementId: 'near', distanceKm: 2 }),
      candidate({ placementId: 'mid', distanceKm: 9 }),
    ]);
    expect(ranked.map((c) => c.placementId)).toEqual(['near', 'mid', 'far']);
  });

  it('does not mutate the input array', () => {
    const input = [candidate({ placementId: 'b', distanceKm: 9 }), candidate({ placementId: 'a', distanceKm: 1 })];
    rankByProximity(input);
    expect(input.map((c) => c.placementId)).toEqual(['b', 'a']);
  });
});
