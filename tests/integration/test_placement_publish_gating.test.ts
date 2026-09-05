import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, asUser, connect, createProfile, verifyBusiness } from '../helpers/db';

/**
 * T018 — FR-002: an unverified business cannot publish. Enforced by RLS, so this test asserts
 * against a real Postgres with policies active (Principle II: no mocked persistence).
 */

let client: Client;
let unverifiedBusiness: string;
let verifiedBusiness: string;
let opsActor: string;

const draft = {
  tradeCategory: 'electrical',
  description: 'Residential rewiring support alongside a licensed electrician, summer schedule.',
  region: 'US-MI',
  hourlyRate: 18.0,
};

async function insertPlacement(
  db: Client,
  businessId: string,
  status: 'draft' | 'open',
  overrides: Partial<typeof draft> = {},
): Promise<string> {
  const values = { ...draft, ...overrides };
  const { rows } = await db.query(
    `insert into placements (business_id, trade_category, description, coarse_location,
       postal_code, region, duration_weeks, weekly_hours, hourly_rate, capacity,
       start_window_start, start_window_end, age_restriction_category, status)
     values ($1, $2, $3,
       extensions.ST_SetSRID(extensions.ST_MakePoint(-83.05, 42.33), 4326)::extensions.geography,
       '48201', $4, 10, 20, $5, 1, '2026-06-15', '2026-06-30', 'none', $6)
     returning id`,
    [businessId, values.tradeCategory, values.description, values.region, values.hourlyRate, status],
  );
  return rows[0].id as string;
}

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    unverifiedBusiness = await createProfile(db, { accountType: 'business' });
    verifiedBusiness = await createProfile(db, { accountType: 'business' });
    opsActor = await createProfile(db, { accountType: 'organization' });
    await verifyBusiness(db, verifiedBusiness, opsActor);
  });
});

afterAll(async () => {
  await client.end();
});

describe('placement publishing gate (FR-002)', () => {
  it('refuses to publish an open placement for an unverified business', async () => {
    await expect(
      asUser(client, unverifiedBusiness, (db) => insertPlacement(db, unverifiedBusiness, 'open')),
    ).rejects.toThrow(/row-level security/i);
  });

  it('allows an unverified business to keep the placement as a draft', async () => {
    const id = await asUser(client, unverifiedBusiness, (db) =>
      insertPlacement(db, unverifiedBusiness, 'draft'),
    );
    expect(id).toBeTruthy();
  });

  it('allows a verified business to publish', async () => {
    const id = await asUser(client, verifiedBusiness, (db) =>
      insertPlacement(db, verifiedBusiness, 'open'),
    );
    expect(id).toBeTruthy();
  });

  it('withdraws live placements from search when verification is revoked (edge case)', async () => {
    const placementId = await asUser(client, verifiedBusiness, (db) =>
      insertPlacement(db, verifiedBusiness, 'open'),
    );

    await asService(client, async (db) => {
      await db.query('select record_verification_decision($1, $2, $3)', [
        verifiedBusiness,
        opsActor,
        'revoked',
      ]);
    });

    const { status, auditCount } = await asService(client, async (db) => {
      const placement = await db.query('select status from placements where id = $1', [placementId]);
      const audit = await db.query(
        `select count(*)::int as count from audit_log
          where subject_type = 'business' and subject_id = $1 and action = 'revoked'`,
        [verifiedBusiness],
      );
      return { status: placement.rows[0].status as string, auditCount: audit.rows[0].count as number };
    });

    expect(status).toBe('withdrawn');
    expect(auditCount).toBeGreaterThan(0);
  });
});
