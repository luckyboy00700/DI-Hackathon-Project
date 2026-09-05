import type { AgeRestrictionCategory } from '@/lib/validation/enums';

/**
 * Age gating (FR-010). Framework-free by construction — constitution Principle I keeps this
 * importable without React or Next so the rule can be unit-tested in isolation.
 *
 * All dates are ISO calendar dates (YYYY-MM-DD) and are compared as calendar dates, not
 * instants: an apprentice's eligibility must not depend on the server's timezone.
 */

type IsoDate = string;

function parts(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  return { year, month, day };
}

/** Whole years completed on `onDate` by someone born on `dateOfBirth`. */
export function ageOnDate(dateOfBirth: IsoDate, onDate: IsoDate): number {
  const birth = parts(dateOfBirth);
  const target = parts(onDate);

  let age = target.year - birth.year;
  const hasHadBirthday =
    target.month > birth.month || (target.month === birth.month && target.day >= birth.day);
  if (!hasHadBirthday) age -= 1;
  return age;
}

export function isMinorOn(dateOfBirth: IsoDate, onDate: IsoDate): boolean {
  return ageOnDate(dateOfBirth, onDate) < 18;
}

/**
 * Eligibility is evaluated against age at the PLACEMENT START DATE, never the application date —
 * an applicant who turns 18 mid-application is eligible for a placement starting after that
 * birthday (spec edge case).
 */
export function isAgeEligible(input: {
  dateOfBirth: IsoDate;
  placementStartDate: IsoDate;
  ageRestrictionCategory: AgeRestrictionCategory;
}): boolean {
  if (input.ageRestrictionCategory === 'none') return true;
  return !isMinorOn(input.dateOfBirth, input.placementStartDate);
}
