import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asService, connect, createProfile } from '../helpers/db';
import { AGREEMENT_JSON, makeApplication, makePlacement, makeVerifiedBusiness } from '../helpers/fixtures';

/**
 * T045 — FR-014. A minor cannot be accepted without a recorded guardian consent artifact.
 * Constitution Principle V calls this out as never-relaxed, in any mode.
 */

let client: Client;
let business: string;
let minorApplication: string;
let adultApplication: string;
let minorId: string;

beforeAll(async () => {
  client = await connect();
  await asService(client, async (db) => {
    ({ business } = await makeVerifiedBusiness(db));
    const placement = await makePlacement(db, business, { capacity: 5, startDate: '2026-06-15' });

    minorId = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2010-01-01' });
    const adultId = await createProfile(db, { accountType: 'apprentice', dateOfBirth: '2004-01-01' });

    minorApplication = await makeApplication(db, placement, minorId);
    adultApplication = await makeApplication(db, placement, adultId);
  });
});

afterAll(async () => {
  await client.end();
});

describe('guardian consent gate (FR-014)', () => {
  it('flags a minor application as needing consent', async () => {
    const needs = await asService(client, async (db) => {
      const { rows } = await db.query('select application_needs_guardian_consent($1) as needs', [
        minorApplication,
      ]);
      return rows[0].needs as boolean;
    });
    expect(needs).toBe(true);
  });

  it('does not require consent for an adult applicant', async () => {
    const needs = await asService(client, async (db) => {
      const { rows } = await db.query('select application_needs_guardian_consent($1) as needs', [
        adultApplication,
      ]);
      return rows[0].needs as boolean;
    });
    expect(needs).toBe(false);
  });

  it('BLOCKS acceptance of a minor with no consent on file', async () => {
    await expect(
      asService(client, (db) =>
        db.query('select accept_application($1, $2, $3::jsonb)', [
          minorApplication,
          business,
          AGREEMENT_JSON,
        ]),
      ),
    ).rejects.toThrow(/GUARDIAN_CONSENT_REQUIRED/);
  });

  it('allows acceptance of the same minor once consent is recorded', async () => {
    await asService(client, async (db) => {
      await db.query(
        `insert into guardian_consents (application_id, document_path, recorded_by)
         values ($1, $2, $3)`,
        [minorApplication, `${minorId}/consent.pdf`, minorId],
      );
    });

    const agreementId = await asService(client, async (db) => {
      const { rows } = await db.query('select accept_application($1, $2, $3::jsonb) as id', [
        minorApplication,
        business,
        AGREEMENT_JSON,
      ]);
      return rows[0].id as string;
    });
    expect(agreementId).toBeTruthy();
  });

  it('accepts an adult with no consent artifact at all', async () => {
    const agreementId = await asService(client, async (db) => {
      const { rows } = await db.query('select accept_application($1, $2, $3::jsonb) as id', [
        adultApplication,
        business,
        AGREEMENT_JSON,
      ]);
      return rows[0].id as string;
    });
    expect(agreementId).toBeTruthy();
  });

  it('writes audit rows for the acceptance and the agreement (FR-023)', async () => {
    const actions = await asService(client, async (db) => {
      const { rows } = await db.query(
        `select action from audit_log where subject_id = $1 or subject_type = 'agreement'`,
        [minorApplication],
      );
      return rows.map((r) => r.action as string);
    });
    expect(actions).toContain('accepted');
    expect(actions).toContain('agreement_generated');
  });
});
