import type { EndorsementSubjectType } from '@/lib/validation/enums';

/**
 * Self-endorsement rules (FR-004). Framework-free so the rule can be tested in isolation; the
 * database enforces the same thing independently (Principle V), this is not the only guard.
 */

export type EndorsementRequest = {
  organizationId: string;
  subjectType: EndorsementSubjectType;
  subjectId: string;
  /** Businesses this organization operates — a vouching org may register a business account too. */
  operatedBusinessIds: string[];
};

export type EndorsementCheck =
  | { allowed: true }
  | { allowed: false; reason: 'self' | 'operated_business' };

export function checkEndorsement(request: EndorsementRequest): EndorsementCheck {
  if (request.subjectId === request.organizationId) {
    return { allowed: false, reason: 'self' };
  }

  if (
    request.subjectType === 'business' &&
    request.operatedBusinessIds.includes(request.subjectId)
  ) {
    return { allowed: false, reason: 'operated_business' };
  }

  return { allowed: true };
}
