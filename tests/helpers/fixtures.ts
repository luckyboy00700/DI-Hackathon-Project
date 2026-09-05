import type { Client } from 'pg';
import { createProfile, verifyBusiness } from './db';

/** Shared arrangement helpers for the US3 suites. */

export async function makeVerifiedBusiness(db: Client): Promise<{ business: string; ops: string }> {
  const ops = await createProfile(db, { accountType: 'organization' });
  const business = await createProfile(db, { accountType: 'business' });
  await verifyBusiness(db, business, ops);
  return { business, ops };
}

export async function makePlacement(
  db: Client,
  business: string,
  options: { capacity?: number; hazard?: string; startDate?: string } = {},
): Promise<string> {
  const { rows } = await db.query(
    `insert into placements (business_id, trade_category, description, postal_code, region,
       duration_weeks, weekly_hours, hourly_rate, capacity, start_window_start, start_window_end,
       age_restriction_category, status)
     values ($1, 'carpentry', 'Finish carpentry support on residential remodels for the summer.',
       '48201', 'US-MI', 10, 20, 20.00, $2, $3, $3, $4, 'open')
     returning id`,
    [business, options.capacity ?? 1, options.startDate ?? '2026-06-15', options.hazard ?? 'none'],
  );
  return rows[0].id as string;
}

export async function makeApplication(
  db: Client,
  placement: string,
  apprentice: string,
): Promise<string> {
  const { rows } = await db.query(
    `insert into applications (placement_id, apprentice_id, availability, statement)
     values ($1, $2, 'Weekday mornings from mid-June', 'I want to learn this trade properly.')
     returning id`,
    [placement, apprentice],
  );
  return rows[0].id as string;
}

export const AGREEMENT_JSON = JSON.stringify({
  durationWeeks: 10,
  weeklyHours: 20,
  hourlyRate: 20,
  totalEstimatedHours: 200,
  estimatedGrossPay: 4000,
  mentorshipMilestones: ['Week 1: induction'],
  safetyObligations: ['PPE provided'],
  terminationTerms: 'Either party may end this placement.',
});
