import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, asUser, connect, createProfile, verifyBusiness } from '../helpers/db';

/**
 * T031 — FR-010 / constitution Principle V. The single most important test in the suite:
 * age-restricted placements must be excluded SERVER-SIDE for under-18 applicants. If this
 * passes only because a component filtered the list, the platform has already failed.
 */

let client: Client;
let minorId: string;
let adultId: string;
let turns18DuringId: string;
let restrictedPlacement: string;
let openPlacement: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    const ops = await createProfile(db, { accountType: 'organization' });
    const business = await createProfile(db, { accountType: 'business' });
    await verifyBusiness(db, business, ops);

    // Placement starts 2026-06-15.
    minorId = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2011-01-01' });
    adultId = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
    // Turns 18 on 2026-06-01 — BEFORE the placement starts, so eligible for restricted work.
    turns18DuringId = await createProfile(db, {
      accountType: 'apprentice',
      dateOfBirth: '2008-06-01',
    });

    const insert = async (hazard: string) => {
      const { rows } = await db.query(
        `insert into placements (business_id, trade_category, description, postal_code, region,
           duration_weeks, weekly_hours, hourly_rate, capacity, start_window_start,
           start_window_end, age_restriction_category, status)
         values ($1, 'electrical', 'High voltage support work for the summer season with a mentor.',
           '48201', 'US-MI', 10, 20, 20.00, 2, '2026-06-15', '2026-06-30', $2, 'open')
         returning id`,
        [business, hazard],
      );
      return rows[0].id as string;
    };
    restrictedPlacement = await insert('high_voltage');
    openPlacement = await insert('none');
  });
});

afterAll(async () => {
  await client.end();
});

async function searchIds(userId: string): Promise<string[]> {
  return asUser(client, userId, async (db) => {
    const { rows } = await db.query('select placement_id from search_placements($1, null)', [500]);
    return rows.map((r) => r.placement_id as string);
  });
}

describe('server-side age gating (FR-010)', () => {
  it('excludes age-restricted placements for an under-18 searcher', async () => {
    const ids = await searchIds(minorId);
    expect(ids).not.toContain(restrictedPlacement);
  });

  it('still shows unrestricted placements to the same minor', async () => {
    const ids = await searchIds(minorId);
    expect(ids).toContain(openPlacement);
  });

  it('shows age-restricted placements to an adult searcher', async () => {
    const ids = await searchIds(adultId);
    expect(ids).toContain(restrictedPlacement);
  });

  it('evaluates age at the placement start date, not the application date', async () => {
    // This applicant is 17 today but 18 when the placement starts — must be eligible.
    const ids = await searchIds(turns18DuringId);
    expect(ids).toContain(restrictedPlacement);
  });

  it('never returns a restricted placement to a minor even when directly filtered for', async () => {
    // Proves exclusion is not merely a default: the predicate holds under an explicit query.
    const rows = await asUser(client, minorId, async (db) => {
      const result = await db.query(
        `select placement_id from search_placements($1, 'electrical'::trade_category)`,
        [500],
      );
      return result.rows;
    });
    expect(rows.map((r) => r.placement_id)).not.toContain(restrictedPlacement);
  });
});
