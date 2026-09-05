import { isAgeEligible } from './eligibility';
import type { AgeRestrictionCategory, PlacementStatus, TradeCategory } from '@/lib/validation/enums';

/**
 * Search filtering and ranking (FR-008 – FR-011). This module mirrors, in pure TypeScript, the
 * same predicate the SQL query applies — it is the testable specification of that predicate, not
 * a substitute for it. The database remains the enforcement point (Principle V).
 */

export type SearchCandidate = {
  placementId: string;
  distanceKm: number;
  tradeCategory: TradeCategory;
  durationWeeks: number;
  weeklyHours: number;
  startDate: string;
  ageRestrictionCategory: AgeRestrictionCategory;
  businessVerified: boolean;
  status: PlacementStatus;
};

export type SearchFilters = {
  distanceKm: number;
  tradeCategory?: TradeCategory;
  minWeeks?: number;
  maxWeeks?: number;
  minWeeklyHours?: number;
  maxWeeklyHours?: number;
  startAfter?: string;
  startBefore?: string;
};

export type Viewer = { dateOfBirth: string };

export function buildSearchPredicate(
  filters: SearchFilters,
  viewer: Viewer,
): (candidate: SearchCandidate) => boolean {
  return (candidate) => {
    if (candidate.status !== 'open') return false;
    if (!candidate.businessVerified) return false;
    if (candidate.distanceKm > filters.distanceKm) return false;
    if (filters.tradeCategory && candidate.tradeCategory !== filters.tradeCategory) return false;
    if (filters.minWeeks !== undefined && candidate.durationWeeks < filters.minWeeks) return false;
    if (filters.maxWeeks !== undefined && candidate.durationWeeks > filters.maxWeeks) return false;
    if (filters.minWeeklyHours !== undefined && candidate.weeklyHours < filters.minWeeklyHours) {
      return false;
    }
    if (filters.maxWeeklyHours !== undefined && candidate.weeklyHours > filters.maxWeeklyHours) {
      return false;
    }
    if (filters.startAfter && candidate.startDate < filters.startAfter) return false;
    if (filters.startBefore && candidate.startDate > filters.startBefore) return false;

    return isAgeEligible({
      dateOfBirth: viewer.dateOfBirth,
      placementStartDate: candidate.startDate,
      ageRestrictionCategory: candidate.ageRestrictionCategory,
    });
  };
}

/** Proximity ordering is the default result order (FR-009). */
export function rankByProximity<T extends { distanceKm: number }>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => a.distanceKm - b.distanceKm);
}
