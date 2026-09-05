import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, connect, createProfile, verifyBusiness } from '../helpers/db';

/** T019 — FR-007: per-region wage floor, enforced in the engine on insert AND on edit. */

let client: Client;
let business: string;

async function insertAt(db: Client, region: string, hourlyRate: number): Promise<string> {
  const { rows } = await db.query(
    `insert into placements (business_id, trade_category, description, coarse_location,
       postal_code, region, duration_weeks, weekly_hours, hourly_rate, capacity,
       start_window_start, start_window_end, status)
     values ($1, 'carpentry', 'Finish carpentry assistance on residential remodels this summer.',
       extensions.ST_SetSRID(extensions.ST_MakePoint(-83.05, 42.33), 4326)::extensions.geography,
       '48201', $2, 10, 20, $3, 1, '2026-06-15', '2026-06-30', 'draft')
     returning id`,
    [business, region, hourlyRate],
  );
  return rows[0].id as string;
}

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    const ops = await createProfile(db, { accountType: 'organization' });
    business = await createProfile(db, { accountType: 'business' });
    await verifyBusiness(db, business, ops);
  });
});

afterAll(async () => {
  await client.end();
});

describe('wage floor (FR-007)', () => {
  it('rejects a rate below the region floor', async () => {
    // US-IL floor is 15.00
    await expect(asService(client, (db) => insertAt(db, 'US-IL', 14.99))).rejects.toThrow(
      /RATE_BELOW_WAGE_FLOOR/,
    );
  });

  it('accepts a rate exactly at the region floor', async () => {
    const id = await asService(client, (db) => insertAt(db, 'US-IL', 15.0));
    expect(id).toBeTruthy();
  });

  it('applies a DIFFERENT floor per region for the same rate', async () => {
    // 8.00 is under Illinois' floor but over Indiana's (7.25) — proving the lookup is per-region
    // rather than a single global constant.
    await expect(asService(client, (db) => insertAt(db, 'US-IL', 8.0))).rejects.toThrow(
      /RATE_BELOW_WAGE_FLOOR/,
    );
    const id = await asService(client, (db) => insertAt(db, 'US-IN', 8.0));
    expect(id).toBeTruthy();
  });

  it('re-checks the floor when a placement is edited down', async () => {
    const id = await asService(client, (db) => insertAt(db, 'US-IL', 20.0));
    await expect(
      asService(client, (db) =>
        db.query('update placements set hourly_rate = 9.00 where id = $1', [id]),
      ),
    ).rejects.toThrow(/RATE_BELOW_WAGE_FLOOR/);
  });

  it('rejects a region with no configured floor', async () => {
    await expect(asService(client, (db) => insertAt(db, 'XX-ZZ', 50.0))).rejects.toThrow();
  });
});
