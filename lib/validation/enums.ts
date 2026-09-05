import { z } from 'zod';

/** Closed enums shared by the Zod boundary schemas and the Postgres enum types. */

export const accountType = z.enum(['apprentice', 'business', 'organization']);
export type AccountType = z.infer<typeof accountType>;

export const verificationStatus = z.enum(['unverified', 'verified', 'revoked']);
export type VerificationStatus = z.infer<typeof verificationStatus>;

/**
 * Hazardous-occupation classification (research.md §3). Anything other than `none` makes the
 * placement age-restricted, which keeps the FR-010 gate a decidable SQL predicate.
 */
export const ageRestrictionCategory = z.enum([
  'none',
  'heavy_equipment',
  'high_voltage',
  'confined_space',
  'other_hazardous',
]);
export type AgeRestrictionCategory = z.infer<typeof ageRestrictionCategory>;

export const placementStatus = z.enum(['draft', 'open', 'withdrawn', 'filled']);
export type PlacementStatus = z.infer<typeof placementStatus>;

export const applicationStatus = z.enum([
  'submitted',
  'under_review',
  'accepted',
  'declined',
  'withdrawn',
]);
export type ApplicationStatus = z.infer<typeof applicationStatus>;

/** Distinguishes an apprentice-initiated withdrawal from a business-initiated termination. */
export const withdrawalReasonCategory = z.enum([
  'apprentice_withdrew',
  'business_terminated',
  'mutual',
  'other',
]);
export type WithdrawalReasonCategory = z.infer<typeof withdrawalReasonCategory>;

export const tradeCategory = z.enum([
  'electrical',
  'plumbing',
  'carpentry',
  'hvac',
  'welding',
  'masonry',
  'automotive',
  'landscaping',
  'print_design',
  'photography',
  'videography',
  'upholstery',
]);
export type TradeCategory = z.infer<typeof tradeCategory>;

export const endorsementSubjectType = z.enum(['apprentice', 'business']);
export type EndorsementSubjectType = z.infer<typeof endorsementSubjectType>;
