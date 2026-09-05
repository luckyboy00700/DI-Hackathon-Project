import { describe, expect, it } from 'vitest';
import { buildAgreement, type AgreementInput } from '@/lib/domain/agreement';

/** T038 — written before lib/domain/agreement.ts exists (constitution Principle II). */

function input(overrides: Partial<AgreementInput> = {}): AgreementInput {
  return {
    tradeCategory: 'electrical',
    durationWeeks: 10,
    weeklyHours: 20,
    hourlyRate: 18.5,
    startDate: '2026-06-15',
    ageRestrictionCategory: 'none',
    requiredCertifications: [],
    apprenticeIsMinor: false,
    ...overrides,
  };
}

describe('buildAgreement', () => {
  it('carries every term FR-016 requires', () => {
    const agreement = buildAgreement(input());
    expect(agreement.durationWeeks).toBe(10);
    expect(agreement.weeklyHours).toBe(20);
    expect(agreement.hourlyRate).toBe(18.5);
    expect(agreement.mentorshipMilestones.length).toBeGreaterThan(0);
    expect(agreement.safetyObligations.length).toBeGreaterThan(0);
    expect(agreement.terminationTerms).toBeTruthy();
  });

  it('produces identical content for both parties from the same inputs', () => {
    // FR-016: "both parties receive an identical agreement".
    expect(buildAgreement(input())).toEqual(buildAgreement(input()));
  });

  it('computes total hours and estimated gross pay from the schedule', () => {
    const agreement = buildAgreement(input({ durationWeeks: 10, weeklyHours: 20, hourlyRate: 18.5 }));
    expect(agreement.totalEstimatedHours).toBe(200);
    expect(agreement.estimatedGrossPay).toBe(3700);
  });

  it('rounds estimated pay to whole cents', () => {
    const agreement = buildAgreement(input({ durationWeeks: 3, weeklyHours: 7, hourlyRate: 15.33 }));
    expect(agreement.estimatedGrossPay).toBe(321.93);
  });

  it('scales mentorship milestones with the placement length', () => {
    const short = buildAgreement(input({ durationWeeks: 4 }));
    const long = buildAgreement(input({ durationWeeks: 20 }));
    expect(long.mentorshipMilestones.length).toBeGreaterThan(short.mentorshipMilestones.length);
  });

  it('always includes at least one milestone even for the shortest placement', () => {
    expect(buildAgreement(input({ durationWeeks: 1 })).mentorshipMilestones.length).toBeGreaterThan(0);
  });

  it('adds guardian-consent and supervision terms for a minor', () => {
    const forMinor = buildAgreement(input({ apprenticeIsMinor: true }));
    const forAdult = buildAgreement(input({ apprenticeIsMinor: false }));
    expect(forMinor.safetyObligations.join(' ')).toMatch(/guardian/i);
    expect(forMinor.safetyObligations.length).toBeGreaterThan(forAdult.safetyObligations.length);
  });

  it('names required certifications in the obligations when present', () => {
    const agreement = buildAgreement(input({ requiredCertifications: ['OSHA 10'] }));
    expect(agreement.safetyObligations.join(' ')).toContain('OSHA 10');
  });

  it('refuses to build an agreement placing a minor in hazardous work', () => {
    // Defence in depth: the DB blocks this too, but the generator must never emit such a document.
    expect(() =>
      buildAgreement(input({ apprenticeIsMinor: true, ageRestrictionCategory: 'high_voltage' })),
    ).toThrow(/minor/i);
  });

  it('allows hazardous work for an adult apprentice', () => {
    const agreement = buildAgreement(
      input({ apprenticeIsMinor: false, ageRestrictionCategory: 'high_voltage' }),
    );
    expect(agreement.safetyObligations.join(' ')).toMatch(/hazard/i);
  });
});
