import { describe, expect, it } from 'vitest';
import {
  ageOnDate,
  isAgeEligible,
  isMinorOn,
} from '@/lib/domain/eligibility';

/**
 * T028 — written before lib/domain/eligibility.ts exists (constitution Principle II).
 * Age gating has legal consequences; every boundary here is deliberate.
 */

describe('ageOnDate', () => {
  it('computes age at a date after the birthday in that year', () => {
    expect(ageOnDate('2008-03-10', '2026-06-01')).toBe(18);
  });

  it('computes age at a date before the birthday in that year', () => {
    expect(ageOnDate('2008-09-10', '2026-06-01')).toBe(17);
  });

  it('treats the birthday itself as the day the age increments', () => {
    expect(ageOnDate('2008-06-01', '2026-06-01')).toBe(18);
  });

  it('treats the day before the birthday as still the younger age', () => {
    expect(ageOnDate('2008-06-02', '2026-06-01')).toBe(17);
  });

  it('handles a 29 February birth date in a non-leap evaluation year', () => {
    expect(ageOnDate('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOnDate('2008-02-29', '2026-03-01')).toBe(18);
  });
});

describe('isMinorOn', () => {
  it('is true below 18 and false at exactly 18', () => {
    expect(isMinorOn('2008-06-02', '2026-06-01')).toBe(true);
    expect(isMinorOn('2008-06-01', '2026-06-01')).toBe(false);
  });
});

describe('isAgeEligible', () => {
  const startDate = '2026-06-15';

  it('allows an unrestricted placement for a minor', () => {
    expect(
      isAgeEligible({
        dateOfBirth: '2009-01-01',
        placementStartDate: startDate,
        ageRestrictionCategory: 'none',
      }),
    ).toBe(true);
  });

  it('blocks a restricted placement for someone under 18 at the START date', () => {
    // Turns 18 on 2026-07-01 — after the placement starts, so still a minor for this placement.
    expect(
      isAgeEligible({
        dateOfBirth: '2008-07-01',
        placementStartDate: startDate,
        ageRestrictionCategory: 'heavy_equipment',
      }),
    ).toBe(false);
  });

  it('allows a restricted placement when the applicant turns 18 before the start date', () => {
    // Edge case from spec: eligibility is evaluated at placement start, not application date.
    expect(
      isAgeEligible({
        dateOfBirth: '2008-06-01',
        placementStartDate: startDate,
        ageRestrictionCategory: 'high_voltage',
      }),
    ).toBe(true);
  });

  it('blocks every hazardous category for a minor', () => {
    for (const category of [
      'heavy_equipment',
      'high_voltage',
      'confined_space',
      'other_hazardous',
    ] as const) {
      expect(
        isAgeEligible({
          dateOfBirth: '2010-01-01',
          placementStartDate: startDate,
          ageRestrictionCategory: category,
        }),
      ).toBe(false);
    }
  });
});
