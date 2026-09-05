import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, asUser, connect, createProfile } from '../helpers/db';
import { AGREEMENT_JSON, makeApplication, makePlacement, makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T046 — FR-015 / constitution Principle V: "No unmediated exchange of personal contact details
 * before both parties have accepted a placement."
 */

let client: Client;
let business: string;
let apprentice: string;
let application: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    ({ business } = await makeVerifiedBusiness(db));
    const placement = await makePlacement(db, business, { capacity: 2 });
    apprentice = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-02-02' });

    await db.query(
      `update profiles set contact_email = $2, contact_phone = $3 where id = $1`,
      [apprentice, 'apprentice@example.test', '+1-313-555-0111'],
    );
    await db.query(
      `update profiles set contact_email = $2, contact_phone = $3 where id = $1`,
      [business, 'shop@example.test', '+1-313-555-0122'],
    );

    application = await makeApplication(db, placement, apprentice);
  });
});

afterAll(async () => {
  await client.end();
});

async function contactsFor(userId: string) {
  return asUser(client, userId, async (db) => {
    const { rows } = await db.query(
      `select apprentice_email, apprentice_phone, business_email, business_phone, status
         from application_contacts where application_id = $1`,
      [application],
    );
    return rows[0];
  });
}

describe('contact withholding before acceptance (FR-015)', () => {
  it('hides the apprentice contact details from the mentor while under review', async () => {
    const row = await contactsFor(business);
    expect(row.status).toBe('submitted');
    expect(row.apprentice_email).toBeNull();
    expect(row.apprentice_phone).toBeNull();
  });

  it('hides the business contact details from the apprentice while under review', async () => {
    const row = await contactsFor(apprentice);
    expect(row.business_email).toBeNull();
    expect(row.business_phone).toBeNull();
  });

  it('does not let a signed-in user read contact columns off profiles directly', async () => {
    // The columns are revoked, so even an explicit select cannot reach them.
    await expect(
      asUser(client, business, (db) =>
        db.query('select contact_email from profiles where id = $1', [apprentice]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('releases BOTH parties contact details once the application is accepted', async () => {
    await asService(client, (db) =>
      db.query('select accept_application($1, $2, $3::jsonb)', [application, business, AGREEMENT_JSON]),
    );

    const mentorView = await contactsFor(business);
    expect(mentorView.status).toBe('accepted');
    expect(mentorView.apprentice_email).toBe('apprentice@example.test');

    const apprenticeView = await contactsFor(apprentice);
    expect(apprenticeView.business_email).toBe('shop@example.test');
  });

  it('shows nothing at all to an unrelated third party', async () => {
    const stranger = await asService(client, (db) =>
      createProfile(db, { accountType: 'apprentice', dateOfBirth: '2003-03-03' }),
    );
    const rows = await asUser(client, stranger, async (db) => {
      const result = await db.query(
        'select * from application_contacts where application_id = $1',
        [application],
      );
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });
});
