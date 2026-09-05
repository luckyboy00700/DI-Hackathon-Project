import { describe, expect, it } from 'vitest';
import {
  decideApplicationInput,
  recordGuardianConsentInput,
  submitApplicationInput,
  withdrawApplicationInput,
} from '@/lib/validation/schemas';
import { ERROR_MESSAGES } from '@/lib/errors';

/**
 * T039–T042 — contract tests for submitApplication, recordGuardianConsent, decideApplication and
 * withdrawApplication, against contracts/server-actions.md.
 */

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('submitApplication contract (T039)', () => {
  const valid = {
    placementId: UUID,
    availability: 'Weekday mornings from mid-June',
    experience: '',
    statement: 'I want to learn this trade properly and finish the summer with real skills.',
  };

  it('accepts a complete application', () => {
    expect(submitApplicationInput.safeParse(valid).success).toBe(true);
  });

  it('rejects a non-uuid placement id', () => {
    expect(submitApplicationInput.safeParse({ ...valid, placementId: '12' }).success).toBe(false);
  });

  it('requires a statement of substance', () => {
    expect(submitApplicationInput.safeParse({ ...valid, statement: 'hi' }).success).toBe(false);
  });

  it('takes no apprentice id — the applicant is the session user', () => {
    const parsed = submitApplicationInput.safeParse({ ...valid, apprenticeId: 'someone-else' });
    expect(parsed.success && 'apprenticeId' in parsed.data).toBe(false);
  });
});

describe('recordGuardianConsent contract (T040)', () => {
  it('accepts an application id plus an uploaded document path', () => {
    expect(
      recordGuardianConsentInput.safeParse({ applicationId: UUID, documentPath: 'u/consent.pdf' })
        .success,
    ).toBe(true);
  });

  it('rejects a missing document path — consent is an artifact, not a checkbox', () => {
    expect(recordGuardianConsentInput.safeParse({ applicationId: UUID }).success).toBe(false);
    expect(
      recordGuardianConsentInput.safeParse({ applicationId: UUID, documentPath: '' }).success,
    ).toBe(false);
  });

  it('publishes a plain-language sentence for the consent-required failure', () => {
    expect(ERROR_MESSAGES.GUARDIAN_CONSENT_REQUIRED).toMatch(/guardian consent/i);
    expect(ERROR_MESSAGES.NOT_A_MINOR_APPLICATION).toMatch(/under 18/i);
  });
});

describe('decideApplication contract (T041)', () => {
  it('accepts the two documented decisions', () => {
    expect(decideApplicationInput.safeParse({ applicationId: UUID, decision: 'accepted' }).success).toBe(true);
    expect(decideApplicationInput.safeParse({ applicationId: UUID, decision: 'declined' }).success).toBe(true);
  });

  it('rejects any other decision value', () => {
    expect(decideApplicationInput.safeParse({ applicationId: UUID, decision: 'maybe' }).success).toBe(false);
  });

  it('publishes plain-language sentences for its documented failures', () => {
    expect(ERROR_MESSAGES.CAPACITY_EXCEEDED).toMatch(/full/i);
    expect(ERROR_MESSAGES.APPLICATION_ALREADY_DECIDED).toMatch(/already/i);
  });
});

describe('withdrawApplication contract (T042)', () => {
  it('accepts each documented reason category', () => {
    for (const reasonCategory of [
      'apprentice_withdrew',
      'business_terminated',
      'mutual',
      'other',
    ] as const) {
      expect(withdrawApplicationInput.safeParse({ applicationId: UUID, reasonCategory }).success).toBe(true);
    }
  });

  it('requires a reason category — FR-018 records why, not just that', () => {
    expect(withdrawApplicationInput.safeParse({ applicationId: UUID }).success).toBe(false);
  });

  it('accepts an optional free-text note within bounds', () => {
    expect(
      withdrawApplicationInput.safeParse({
        applicationId: UUID,
        reasonCategory: 'other',
        note: 'Moved out of the area.',
      }).success,
    ).toBe(true);
    expect(
      withdrawApplicationInput.safeParse({
        applicationId: UUID,
        reasonCategory: 'other',
        note: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('publishes a plain-language sentence for an already-closed application', () => {
    expect(ERROR_MESSAGES.ALREADY_TERMINAL).toMatch(/closed/i);
  });
});
