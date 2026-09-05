import { z } from 'zod';
import {
  ageRestrictionCategory,
  endorsementSubjectType,
  tradeCategory,
  withdrawalReasonCategory,
} from './enums';

/**
 * Boundary schemas (constitution Principle I). Every Server Action parses its input through the
 * matching schema here before anything reaches lib/db. Client-side use is UX only.
 */

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

export const searchPlacementsInput = z.object({
  distanceKm: z.number().positive().max(500),
  tradeCategory: tradeCategory.optional(),
  minWeeks: z.number().int().positive().optional(),
  maxWeeks: z.number().int().positive().optional(),
  minWeeklyHours: z.number().int().positive().max(60).optional(),
  maxWeeklyHours: z.number().int().positive().max(60).optional(),
  startAfter: isoDate.optional(),
  startBefore: isoDate.optional(),
  page: z.number().int().min(1).default(1),
});
export type SearchPlacementsInput = z.infer<typeof searchPlacementsInput>;

export const createPlacementInput = z.object({
  tradeCategory,
  description: z.string().min(20).max(2000),
  postalCode: z.string().min(3).max(12),
  region: z.string().min(2).max(64),
  durationWeeks: z.number().int().min(1).max(52),
  weeklyHours: z.number().int().min(1).max(40),
  hourlyRate: z.number().positive().max(500),
  capacity: z.number().int().min(1).max(50),
  startWindowStart: isoDate,
  startWindowEnd: isoDate,
  requiredCertifications: z.array(z.string().min(1).max(80)).max(10).default([]),
  ageRestrictionCategory,
});
export type CreatePlacementInput = z.infer<typeof createPlacementInput>;

export const submitApplicationInput = z.object({
  placementId: uuid,
  availability: z.string().min(3).max(500),
  experience: z.string().max(2000).default(''),
  statement: z.string().min(10).max(2000),
});
export type SubmitApplicationInput = z.infer<typeof submitApplicationInput>;

export const recordGuardianConsentInput = z.object({
  applicationId: uuid,
  documentPath: z.string().min(1).max(400),
});
export type RecordGuardianConsentInput = z.infer<typeof recordGuardianConsentInput>;

export const decideApplicationInput = z.object({
  applicationId: uuid,
  decision: z.enum(['accepted', 'declined']),
});
export type DecideApplicationInput = z.infer<typeof decideApplicationInput>;

export const withdrawApplicationInput = z.object({
  applicationId: uuid,
  reasonCategory: withdrawalReasonCategory,
  note: z.string().max(500).optional(),
});
export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationInput>;

export const signCompetencyInput = z.object({
  applicationId: uuid,
  competency: z.string().min(3).max(160),
});
export type SignCompetencyInput = z.infer<typeof signCompetencyInput>;

export const endorseInput = z.object({
  subjectType: endorsementSubjectType,
  subjectId: uuid,
});
export type EndorseInput = z.infer<typeof endorseInput>;
