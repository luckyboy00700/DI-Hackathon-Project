import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, asUser, connect, createProfile } from '../helpers/db';
import { AGREEMENT_JSON, makeApplication, makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T066 / T067 — FR-019, FR-020, FR-022. Sign-off only while the placement is active, only by the
 * mentor, and never editable by the apprentice.
 */

let client: Client;
let business: string;
let apprentice: string;
let activeApplication: string;
let activePlacement: string;
let endedApplication: string;
let endedPlacement: string;

/** Inserts a placement whose window is relative to today, so "active" is deterministic. */
async function placementRelativeToToday(
  db: Client,
  businessId: string,
  startOffsetDays: number,
  durationWeeks: number,
): Promise<string> {
  const { rows } = await db.query(
    `insert into placements (business_id, trade_category, description, postal_code, region,
       duration_weeks, weekly_hours, hourly_rate, capacity, start_window_start, start_window_end,
       age_restriction_category, status)
     values ($1, 'carpentry', 'Bench joinery and site fitting alongside a working carpenter.',
       '48201', 'US-MI', $2, 20, 20.00, 3,
       current_date + ($3 || ' days')::interval, current_date + ($3 || ' days')::interval,
       'none', 'open')
     returning id`,
    [businessId, durationWeeks, startOffsetDays],
  );
  return rows[0].id as string;
}

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    ({ business } = await makeVerifiedBusiness(db));
    apprentice = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });
    const other = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2003-01-01' });

    // Started a week ago, runs 10 weeks -> active today.
    activePlacement = await placementRelativeToToday(db, business, -7, 10);
    activeApplication = await makeApplication(db, activePlacement, apprentice);
    await db.query('select accept_application($1, $2, $3::jsonb)', [
      activeApplication,
      business,
      AGREEMENT_JSON,
    ]);

    // Started 40 weeks ago, ran 4 weeks -> long finished.
    endedPlacement = await placementRelativeToToday(db, business, -280, 4);
    endedApplication = await makeApplication(db, endedPlacement, other);
    await db.query('select accept_application($1, $2, $3::jsonb)', [
      endedApplication,
      business,
      AGREEMENT_JSON,
    ]);
  });
});

afterAll(async () => {
  await client.end();
});

async function sign(db: Client, application: string, placement: string, mentor: string) {
  return db.query(
    `insert into competency_entries (application_id, placement_id, mentor_id, competency)
     values ($1, $2, $3, 'Terminated and tested a lighting circuit') returning id`,
    [application, placement, mentor],
  );
}

describe('competency sign-off (FR-019, FR-022)', () => {
  it('lets the mentor sign off on an active placement', async () => {
    const result = await asUser(client, business, (db) =>
      sign(db, activeApplication, activePlacement, business),
    );
    expect(result.rows[0].id).toBeTruthy();
  });

  it('rejects sign-off on a placement that has already ended', async () => {
    await expect(
      asUser(client, business, (db) => sign(db, endedApplication, endedPlacement, business)),
    ).rejects.toThrow(/row-level security/i);
  });

  it('rejects sign-off by someone who is not the placement mentor', async () => {
    const otherBusiness = await asService(client, async (db) => {
      const { business: b } = await makeVerifiedBusiness(db);
      return b;
    });
    await expect(
      asUser(client, otherBusiness, (db) => sign(db, activeApplication, activePlacement, otherBusiness)),
    ).rejects.toThrow(/row-level security/i);
  });

  it('rejects sign-off once the placement is withdrawn mid-term', async () => {
    const withdrawn = await asService(client, async (db) => {
      const p = await placementRelativeToToday(db, business, -7, 10);
      const other = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2002-01-01' });
      const a = await makeApplication(db, p, other);
      await db.query('select accept_application($1, $2, $3::jsonb)', [a, business, AGREEMENT_JSON]);
      await db.query('select withdraw_application($1, $2, $3)', [a, business, 'business_terminated']);
      return { application: a, placement: p };
    });

    await expect(
      asUser(client, business, (db) => sign(db, withdrawn.application, withdrawn.placement, business)),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('Skill Passport immutability (FR-020, FR-021)', () => {
  it('shows the entry to the apprentice, attributed and timestamped', async () => {
    const rows = await asUser(client, apprentice, async (db) => {
      const result = await db.query(
        'select competency, mentor_id, signed_at from competency_entries where application_id = $1',
        [activeApplication],
      );
      return result.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].mentor_id).toBe(business);
    expect(rows[0].signed_at).not.toBeNull();
  });

  it('does not let the apprentice edit or delete an entry', async () => {
    // With no permissive UPDATE/DELETE policy the rows are invisible to those statements, so
    // they affect zero rows rather than raising. The guarantee is that nothing changes.
    const updated = await asUser(client, apprentice, (db) =>
      db.query('update competency_entries set competency = $1 where application_id = $2', [
        'Something I did not do',
        activeApplication,
      ]),
    );
    expect(updated.rowCount).toBe(0);

    const deleted = await asUser(client, apprentice, (db) =>
      db.query('delete from competency_entries where application_id = $1', [activeApplication]),
    );
    expect(deleted.rowCount).toBe(0);

    const after = await asUser(client, apprentice, async (db) => {
      const result = await db.query(
        'select competency from competency_entries where application_id = $1',
        [activeApplication],
      );
      return result.rows;
    });
    expect(after).toHaveLength(1);
    expect(after[0].competency).toBe('Terminated and tested a lighting circuit');
  });

  it('blocks even a privileged update, because the entry is immutable by trigger', async () => {
    await expect(
      asService(client, (db) =>
        db.query('update competency_entries set competency = $1 where application_id = $2', [
          'Rewritten history',
          activeApplication,
        ]),
      ),
    ).rejects.toThrow(/immutable once signed/i);
  });

  it('shares the passport by token without exposing contact details', async () => {
    const { token, rows } = await asService(client, async (db) => {
      const t = await db.query('select passport_share_token from profiles where id = $1', [
        apprentice,
      ]);
      const shareToken = t.rows[0].passport_share_token as string;
      const result = await db.query('select * from passport_by_token($1)', [shareToken]);
      return { token: shareToken, rows: result.rows };
    });

    expect(token).toBeTruthy();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].mentor_name).toBeTruthy();
    // No contact columns are exposed by the function's return type at all.
    expect(Object.keys(rows[0])).not.toContain('contact_email');
    expect(Object.keys(rows[0])).not.toContain('date_of_birth');
  });
});
