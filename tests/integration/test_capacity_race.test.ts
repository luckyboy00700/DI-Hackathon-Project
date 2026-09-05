import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { asService, connect, createProfile } from '../helpers/db';
import { AGREEMENT_JSON, makeApplication, makePlacement, makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T044 — FR-017. Capacity must hold under CONCURRENT acceptance, not just sequential checks.
 * Two mentors clicking accept at the same instant is the real failure mode; a read-check-write
 * without the row lock would let both through.
 */

const CONNECTION =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let client: Client;
let business: string;
let placement: string;
let applicationA: string;
let applicationB: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    ({ business } = await makeVerifiedBusiness(db));
    placement = await makePlacement(db, business, { capacity: 1 });

    const a = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
    const b = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2003-05-05' });
    applicationA = await makeApplication(db, placement, a);
    applicationB = await makeApplication(db, placement, b);
  });
});

afterAll(async () => {
  await client.end();
});

/** Accepts on its own connection so the two attempts genuinely race in the database. */
async function acceptOnOwnConnection(applicationId: string): Promise<'ok' | string> {
  const conn = new Client({ connectionString: CONNECTION });
  await conn.connect();
  try {
    await conn.query('select accept_application($1, $2, $3::jsonb)', [
      applicationId,
      business,
      AGREEMENT_JSON,
    ]);
    return 'ok';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await conn.end();
  }
}

describe('atomic capacity enforcement (FR-017)', () => {
  it('lets exactly one of two simultaneous acceptances win on a capacity-1 placement', async () => {
    const [first, second] = await Promise.all([
      acceptOnOwnConnection(applicationA),
      acceptOnOwnConnection(applicationB),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o.includes('CAPACITY_EXCEEDED'))).toHaveLength(1);
  });

  it('records exactly one accepted application afterwards', async () => {
    const accepted = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select count(*)::int as n from applications where placement_id = $1 and status = 'accepted'`,
        [placement],
      );
      return rows[0].n as number;
    });
    expect(accepted).toBe(1);
  });

  it('generates exactly one agreement for the placement', async () => {
    const agreements = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select count(*)::int as n from agreements g
           join applications a on a.id = g.application_id
          where a.placement_id = $1`,
        [placement],
      );
      return rows[0].n as number;
    });
    expect(agreements).toBe(1);
  });

  it('marks the placement filled once the last seat is taken', async () => {
    const status = await asService(client, async (db) => {
      const { rows } = await db.query('select status from placements where id = $1', [placement]);
      return rows[0].status as string;
    });
    expect(status).toBe('filled');
  });
});
