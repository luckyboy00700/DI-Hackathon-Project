import type { AgeRestrictionCategory } from '@/lib/validation/enums';

/**
 * Standardized agreement assembly (FR-016). Pure and deterministic: the same inputs must always
 * produce the same document, because both parties receive it and it is immutable once issued.
 */

export type AgreementInput = {
  tradeCategory: string;
  durationWeeks: number;
  weeklyHours: number;
  hourlyRate: number;
  startDate: string;
  ageRestrictionCategory: AgeRestrictionCategory;
  requiredCertifications: string[];
  apprenticeIsMinor: boolean;
};

export type Agreement = {
  durationWeeks: number;
  weeklyHours: number;
  hourlyRate: number;
  totalEstimatedHours: number;
  estimatedGrossPay: number;
  mentorshipMilestones: string[];
  safetyObligations: string[];
  terminationTerms: string;
};

const TERMINATION_TERMS =
  'Either the apprentice or the mentor may end this placement at any time by recording a withdrawal on the platform, stating a reason category. Hours already worked remain payable at the agreed rate. Ending a placement does not remove competencies already signed off.';

export function buildAgreement(input: AgreementInput): Agreement {
  if (input.apprenticeIsMinor && input.ageRestrictionCategory !== 'none') {
    throw new Error(
      'Cannot generate an agreement placing a minor in restricted work (FR-010 / Principle V)',
    );
  }

  const totalEstimatedHours = input.durationWeeks * input.weeklyHours;
  const estimatedGrossPay = Math.round(totalEstimatedHours * input.hourlyRate * 100) / 100;

  return {
    durationWeeks: input.durationWeeks,
    weeklyHours: input.weeklyHours,
    hourlyRate: input.hourlyRate,
    totalEstimatedHours,
    estimatedGrossPay,
    mentorshipMilestones: buildMilestones(input),
    safetyObligations: buildSafetyObligations(input),
    terminationTerms: TERMINATION_TERMS,
  };
}

/** One review checkpoint roughly every four weeks, plus a start and a close-out. */
function buildMilestones(input: AgreementInput): string[] {
  const milestones = [
    `Week 1: site induction, tools walkthrough, and agreed ${input.tradeCategory.replace(/_/g, ' ')} learning goals.`,
  ];

  const checkpoints = Math.floor(input.durationWeeks / 4);
  for (let i = 1; i <= checkpoints; i += 1) {
    const week = i * 4;
    if (week >= input.durationWeeks) break;
    milestones.push(`Week ${week}: progress review and competency sign-off for skills demonstrated.`);
  }

  milestones.push(
    `Week ${input.durationWeeks}: final review and Skill Passport entries confirmed by the mentor.`,
  );
  return milestones;
}

function buildSafetyObligations(input: AgreementInput): string[] {
  const obligations = [
    'The mentor provides task-appropriate personal protective equipment at no cost to the apprentice.',
    'The mentor supervises all unfamiliar tasks until the apprentice has demonstrated competence.',
    'The apprentice may decline any task they have not been trained for, without penalty.',
  ];

  if (input.requiredCertifications.length > 0) {
    obligations.push(
      `The apprentice holds or will obtain before starting: ${input.requiredCertifications.join(', ')}.`,
    );
  }

  if (input.ageRestrictionCategory !== 'none') {
    obligations.push(
      `This placement is classified as hazardous work (${input.ageRestrictionCategory.replace(/_/g, ' ')}) and is restricted to apprentices aged 18 or over.`,
    );
  }

  if (input.apprenticeIsMinor) {
    obligations.push(
      'A signed guardian consent document is on file and must remain valid for the duration of this placement.',
      'The apprentice is under 18: no hazardous-classified task may be assigned at any point.',
    );
  }

  return obligations;
}
