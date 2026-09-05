import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, asUser, connect, createProfile } from '../helpers/db';
import { makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T074 — FR-004. Self-endorsement is refused by the database, not merely by the domain module,
 * so no code path (or direct API call) can create one.
 */

let client: Client;
let organization: string;
let operatedBusiness: string;
let independentBusiness: string;
let apprentice: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    organization = await createProfile(db, { accountType: 'organization' });
    apprentice = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
    ({ business: operatedBusiness } = await makeVerifiedBusiness(db));
    ({ business: independentBusiness } = await makeVerifiedBusiness(db));

    await db.query(
      `insert into organization_operated_businesses (organization_id, business_id) values ($1, $2)`,
      [organization, operatedBusiness],
    );
  });
});

afterAll(async () => {
  await client.end();
});

async function endorseApprentice(db: Client, org: string, subject: string) {
  return db.query(
    `insert into endorsements (organization_id, subject_type, apprentice_subject_id)
     values ($1, 'apprentice', $2) returning id`,
    [org, subject],
  );
}

async function endorseBusiness(db: Client, org: string, subject: string) {
  return db.query(
    `insert into endorsements (organization_id, subject_type, business_subject_id)
     values ($1, 'business', $2) returning id`,
    [org, subject],
  );
}

describe('endorsements (FR-004, FR-005)', () => {
  it('lets an organization endorse an unrelated apprentice', async () => {
    const result = await asUser(client, organization, (db) =>
      endorseApprentice(db, organization, apprentice),
    );
    expect(result.rows[0].id).toBeTruthy();
  });

  it('lets an organization endorse an unrelated business', async () => {
    const result = await asUser(client, organization, (db) =>
      endorseBusiness(db, organization, independentBusiness),
    );
    expect(result.rows[0].id).toBeTruthy();
  });

  it('REFUSES an organization endorsing a business it operates', async () => {
    await expect(
      asUser(client, organization, (db) => endorseBusiness(db, organization, operatedBusiness)),
    ).rejects.toThrow(/row-level security/i);
  });

  it('REFUSES an organization endorsing its own profile', async () => {
    await expect(
      asUser(client, organization, (db) => endorseApprentice(db, organization, organization)),
    ).rejects.toThrow(/row-level security/i);
  });

  it('refuses an endorsement created on behalf of a different organization', async () => {
    const other = await asService(client, (db) =>
      createProfile(db, { accountType: 'organization' }),
    );
    await expect(
      asUser(client, organization, (db) => endorseApprentice(db, other, apprentice)),
    ).rejects.toThrow(/row-level security/i);
  });

  it('rejects a row whose subject columns contradict its subject_type', async () => {
    await expect(
      asService(client, (db) =>
        db.query(
          `insert into endorsements (organization_id, subject_type, business_subject_id)
           values ($1, 'apprentice', $2)`,
          [organization, independentBusiness],
        ),
      ),
    ).rejects.toThrow(/endorsement_subject_matches_type/);
  });

  it('rejects a duplicate endorsement of the same subject', async () => {
    await expect(
      asUser(client, organization, (db) => endorseApprentice(db, organization, apprentice)),
    ).rejects.toThrow(/duplicate key|endorsement_unique_apprentice/i);
  });

  it('stores no free-text assessment column at all (FR-005)', async () => {
    const columns = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select column_name from information_schema.columns
          where table_name = 'endorsements'`,
      );
      return rows.map((r) => r.column_name as string);
    });
    // The decision is an enum-like constant; there is nowhere to write a character reference.
    expect(columns).toContain('decision');
    expect(columns.some((c) => /comment|note|assessment|reason|text/i.test(c))).toBe(false);
  });
});
