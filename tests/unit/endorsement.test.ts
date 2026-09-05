import { describe, expect, it } from 'vitest';
import { checkEndorsement, type EndorsementRequest } from '@/lib/domain/endorsement';

/**
 * T072 — written before lib/domain/endorsement.ts exists. Endorsement signing is one of the
 * five classes constitution Principle II names for red-green-refactor.
 */

const ORG = 'org-1';

function request(overrides: Partial<EndorsementRequest> = {}): EndorsementRequest {
  return {
    organizationId: ORG,
    subjectType: 'apprentice',
    subjectId: 'apprentice-1',
    operatedBusinessIds: [],
    ...overrides,
  };
}

describe('checkEndorsement', () => {
  it('allows an organization to endorse an unrelated apprentice', () => {
    expect(checkEndorsement(request())).toEqual({ allowed: true });
  });

  it('allows an organization to endorse an unrelated business', () => {
    expect(
      checkEndorsement(request({ subjectType: 'business', subjectId: 'business-9' })),
    ).toEqual({ allowed: true });
  });

  it('rejects an organization endorsing its own profile', () => {
    expect(checkEndorsement(request({ subjectId: ORG }))).toEqual({
      allowed: false,
      reason: 'self',
    });
  });

  it('rejects an organization endorsing a business it operates', () => {
    expect(
      checkEndorsement(
        request({
          subjectType: 'business',
          subjectId: 'business-owned',
          operatedBusinessIds: ['business-other', 'business-owned'],
        }),
      ),
    ).toEqual({ allowed: false, reason: 'operated_business' });
  });

  it('still allows endorsing a business the organization does NOT operate', () => {
    expect(
      checkEndorsement(
        request({
          subjectType: 'business',
          subjectId: 'business-independent',
          operatedBusinessIds: ['business-owned'],
        }),
      ),
    ).toEqual({ allowed: true });
  });

  it('ignores the operated list when the subject is an apprentice', () => {
    // An apprentice id could coincidentally equal a business id in a bad fixture; the rule is
    // about operated BUSINESSES, so the subject type must be part of the decision.
    expect(
      checkEndorsement(
        request({
          subjectType: 'apprentice',
          subjectId: 'business-owned',
          operatedBusinessIds: ['business-owned'],
        }),
      ),
    ).toEqual({ allowed: true });
  });

  it('treats the self check as applying to either subject type', () => {
    expect(checkEndorsement(request({ subjectType: 'business', subjectId: ORG }))).toEqual({
      allowed: false,
      reason: 'self',
    });
  });
});
