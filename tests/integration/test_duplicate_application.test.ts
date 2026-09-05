import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, connect, createProfile } from '../helpers/db';
import { makeApplication, makePlacement, makeVerifiedBusiness } from '../helpers/fixtures';

/** T043 — FR-013: duplicate applications are structurally impossible (unique index). */

let client: Client;
let placement: string;
let otherPlacement: string;
let apprentice: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    const { business } = await makeVerifiedBusiness(db);
    placement = await makePlacement(db, business, { capacity: 3 });
    otherPlacement = await makePlacement(db, business, { capacity: 3 });
    apprentice = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
  });
});

afterAll(async () => {
  await client.end();
});

describe('duplicate application prevention (FR-013)', () => {
  it('accepts the first application', async () => {
    const id = await asService(client, (db) => makeApplication(db, placement, apprentice));
    expect(id).toBeTruthy();
  });

  it('rejects a second application to the same placement by the same apprentice', async () => {
    await expect(
      asService(client, (db) => makeApplication(db, placement, apprentice)),
    ).rejects.toThrow(/duplicate key|applications_one_per_placement/i);
  });

  it('still allows the same apprentice to apply to a DIFFERENT placement', async () => {
    const id = await asService(client, (db) => makeApplication(db, otherPlacement, apprentice));
    expect(id).toBeTruthy();
  });

  it('rejects concurrent duplicate submissions, not just sequential ones', async () => {
    const fresh = await asService(client, (db) =>
      createProfile(db, { accountType: 'apprentice', dateOfBirth: '2003-07-07' }),
    );
    const attempts = await Promise.allSettled([
      asService(client, (db) => makeApplication(db, placement, fresh)),
      asService(client, (db) => makeApplication(db, placement, fresh)),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
  });
});
