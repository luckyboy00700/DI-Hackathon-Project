import { describe, expect, it } from 'vitest';
import { createPlacementInput } from '@/lib/validation/schemas';
import { ERROR_MESSAGES } from '@/lib/errors';

/**
 * T017 — contract test for createPlacement. Asserts the declared boundary schema and the
 * documented error vocabulary in contracts/server-actions.md. The behavioural half (verification
 * gate, wage floor) is covered by the integration tests, which run against real Postgres.
 */

const valid = {
  tradeCategory: 'electrical',
  description: 'Residential rewiring support alongside a licensed electrician, summer schedule.',
  postalCode: '48201',
  region: 'US-MI',
  durationWeeks: 10,
  weeklyHours: 20,
  hourlyRate: 18.5,
  capacity: 2,
  startWindowStart: '2026-06-15',
  startWindowEnd: '2026-06-30',
  requiredCertifications: [],
  ageRestrictionCategory: 'none',
};

describe('createPlacement input contract', () => {
  it('accepts a complete placement covering every FR-006 field', () => {
    expect(createPlacementInput.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown trade category', () => {
    expect(createPlacementInput.safeParse({ ...valid, tradeCategory: 'astrology' }).success).toBe(
      false,
    );
  });

  it('rejects an age-restriction value outside the closed hazard enum', () => {
    expect(
      createPlacementInput.safeParse({ ...valid, ageRestrictionCategory: 'mildly_spicy' }).success,
    ).toBe(false);
  });

  it('rejects a non-positive hourly rate or capacity', () => {
    expect(createPlacementInput.safeParse({ ...valid, hourlyRate: 0 }).success).toBe(false);
    expect(createPlacementInput.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
  });

  it('rejects a malformed start window date', () => {
    expect(createPlacementInput.safeParse({ ...valid, startWindowStart: '15-06-2026' }).success).toBe(
      false,
    );
  });

  it('defaults required certifications to an empty list', () => {
    const { requiredCertifications: _omitted, ...withoutCerts } = valid;
    const parsed = createPlacementInput.safeParse(withoutCerts);
    expect(parsed.success && parsed.data.requiredCertifications).toEqual([]);
  });

  it('publishes plain-language sentences for both documented failure codes', () => {
    // Principle III: no error code reaches a user without a human sentence.
    expect(ERROR_MESSAGES.BUSINESS_NOT_VERIFIED).toMatch(/verified/i);
    expect(ERROR_MESSAGES.RATE_BELOW_WAGE_FLOOR).toMatch(/minimum/i);
  });
});
