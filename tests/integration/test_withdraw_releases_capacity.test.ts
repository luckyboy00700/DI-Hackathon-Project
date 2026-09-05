import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, connect, createProfile } from '../helpers/db';
import { AGREEMENT_JSON, makeApplication, makePlacement, makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T047 — FR-018 and the spec edge case: "an apprentice withdraws after an agreement is generated
 * but before the start date". The seat must come back.
 */

let client: Client;
let business: string;
let placement: string;
let firstApplication: string;
let secondApplication: string;
let apprenticeA: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    ({ business } = await makeVerifiedBusiness(db));
    placement = await makePlacement(db, business, { capacity: 1 });
    apprenticeA = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
    const apprenticeB = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2003-01-01' });
    firstApplication = await makeApplication(db, placement, apprenticeA);
    secondApplication = await makeApplication(db, placement, apprenticeB);

    await db.query('select accept_application($1, $2, $3::jsonb)', [
      firstApplication,
      business,
      AGREEMENT_JSON,
    ]);
  });
});

afterAll(async () => {
  await client.end();
});

describe('withdrawal and termination (FR-018)', () => {
  it('blocks a second acceptance while the seat is still held', async () => {
    await expect(
      asService(client, (db) =>
        db.query('select accept_application($1, $2, $3::jsonb)', [
          secondApplication,
          business,
          AGREEMENT_JSON,
        ]),
      ),
    ).rejects.toThrow(/CAPACITY_EXCEEDED/);
  });

  it('records the reason category, actor and timestamp on withdrawal', async () => {
    const released = await asService(client, async (db) => {
      const { rows } = await db.query('select withdraw_application($1, $2, $3) as released', [
        firstApplication,
        apprenticeA,
        'apprentice_withdrew',
      ]);
      return rows[0].released as boolean;
    });
    expect(released).toBe(true);

    const row = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select status, withdrawal_reason_category, withdrawn_by, withdrawn_at
           from applications where id = $1`,
        [firstApplication],
      );
      return rows[0];
    });
    expect(row.status).toBe('withdrawn');
    expect(row.withdrawal_reason_category).toBe('apprentice_withdrew');
    expect(row.withdrawn_by).toBe(apprenticeA);
    expect(row.withdrawn_at).not.toBeNull();
  });

  it('reopens the placement and frees the seat for the next applicant', async () => {
    const status = await asService(client, async (db) => {
      const { rows } = await db.query('select status from placements where id = $1', [placement]);
      return rows[0].status as string;
    });
    expect(status).toBe('open');

    const agreementId = await asService(client, async (db) => {
      const { rows } = await db.query('select accept_application($1, $2, $3::jsonb) as id', [
        secondApplication,
        business,
        AGREEMENT_JSON,
      ]);
      return rows[0].id as string;
    });
    expect(agreementId).toBeTruthy();
  });

  it('lets the BUSINESS terminate, distinguished by reason category', async () => {
    const row = await asService(client, async (db) => {
      await db.query('select withdraw_application($1, $2, $3)', [
        secondApplication,
        business,
        'business_terminated',
      ]);
      const { rows } = await db.query(
        'select withdrawal_reason_category, withdrawn_by from applications where id = $1',
        [secondApplication],
      );
      return rows[0];
    });
    expect(row.withdrawal_reason_category).toBe('business_terminated');
    expect(row.withdrawn_by).toBe(business);
  });

  it('refuses to withdraw an already-closed application', async () => {
    await expect(
      asService(client, (db) =>
        db.query('select withdraw_application($1, $2, $3)', [
          secondApplication,
          business,
          'other',
        ]),
      ),
    ).rejects.toThrow(/ALREADY_TERMINAL/);
  });

  it('refuses a withdrawal by someone who is not a party to the placement', async () => {
    const stranger = await asService(client, (db) =>
      createProfile(db, { accountType: 'apprentice', dateOfBirth: '2002-02-02' }),
    );
    const fresh = await asService(client, async (db) => {
      const other = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2002-04-04' });
      return makeApplication(db, placement, other);
    });

    await expect(
      asService(client, (db) =>
        db.query('select withdraw_application($1, $2, $3)', [fresh, stranger, 'other']),
      ),
    ).rejects.toThrow(/NOT_AUTHORIZED/);
  });

  it('writes an audit record for every withdrawal (FR-023)', async () => {
    const count = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select count(*)::int as n from audit_log
          where subject_type = 'application' and action = 'withdrawn'`,
      );
      return rows[0].n as number;
    });
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
