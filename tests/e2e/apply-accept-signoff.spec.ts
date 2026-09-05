import { expect, test } from '@playwright/test';
import { seedAccount, signIn, withDb } from './helpers';

/**
 * T081 — demo-critical flow 2: the full trust transaction.
 * apply → guardian consent → accept (agreement generated, contacts released) → competency
 * sign-off appears on the Skill Passport.
 *
 * The minor's application is the interesting case: acceptance must be refused until a signed
 * guardian consent artifact exists (FR-014), which is the failure path this flow also covers.
 */

test.describe('apply → consent → accept → sign-off (User Stories 3 and 4)', () => {
  test('a minor cannot be accepted without consent, then completes the whole journey', async ({
    page,
  }) => {
    const mentor = await seedAccount({
      accountType: 'business',
      displayName: 'E2E Rahman Electric',
      verified: true,
    });
    // Under 18 today and on the placement start date.
    const apprentice = await seedAccount({
      accountType: 'apprentice',
      displayName: 'E2E Yusuf',
      dateOfBirth: '2010-04-01',
    });

    // A placement that is already running, so sign-off is possible at the end of the flow.
    const placementId = await withDb(async (db) => {
      const { rows } = await db.query(
        `insert into placements (business_id, trade_category, description, postal_code, region,
           duration_weeks, weekly_hours, hourly_rate, capacity, start_window_start,
           start_window_end, age_restriction_category, status)
         values ($1, 'electrical', 'Residential rewiring support alongside a licensed electrician.',
           '48201', 'US-MI', 10, 20, 20.00, 1,
           current_date - interval '7 days', current_date - interval '7 days', 'none', 'open')
         returning id`,
        [mentor.id],
      );
      return rows[0].id as string;
    });

    // --- Apprentice applies --------------------------------------------------------------
    await signIn(page, apprentice.email);
    await page.goto(`/placements/${placementId}/apply`);
    await page.getByLabel('When you are available').fill('Weekday mornings');
    await page.getByLabel('Why you want this placement').fill(
      'I want to learn the electrical trade properly and finish the summer with real skills.',
    );
    await page.getByRole('button', { name: 'Send application' }).click();
    await expect(page.getByText('Application sent')).toBeVisible();

    const applicationId = await withDb(async (db) => {
      const { rows } = await db.query(
        'select id from applications where apprentice_id = $1 and placement_id = $2',
        [apprentice.id, placementId],
      );
      return rows[0].id as string;
    });

    // --- Failure path: mentor cannot accept a minor with no consent on file ---------------
    await signIn(page, mentor.email);
    await page.goto('/applications');
    await expect(page.getByText('Awaiting guardian consent', { exact: true })).toBeVisible();

    // Assert on the ERROR ALERT, not on the standing hint about the applicant's state: the two
    // used to read identically, so matching text alone passed before the click had even landed.
    await page.getByRole('button', { name: 'Accept' }).click();
    const refusal = page.getByRole('alert').filter({ hasText: 'Could not record that decision' });
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText(/guardian consent document must be on file/i);

    // Contact details must still be withheld at this point (FR-015).
    const beforeAcceptance = await withDb(async (db) => {
      const { rows } = await db.query(
        'select status from applications where id = $1',
        [applicationId],
      );
      return rows[0].status as string;
    });
    expect(beforeAcceptance).not.toBe('accepted');

    // --- Guardian consent is recorded ------------------------------------------------------
    await withDb(async (db) => {
      await db.query(
        `insert into guardian_consents (application_id, document_path, recorded_by)
         values ($1, $2, $3)`,
        [applicationId, `${apprentice.id}/signed-consent.pdf`, apprentice.id],
      );
    });

    // --- Success path: acceptance now generates the agreement -----------------------------
    await page.goto('/applications');
    await expect(page.getByText('Guardian consent on file', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).click();

    // The durable confirmation is the revalidated row: status flips and the decision controls go.
    await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);

    const agreementId = await withDb(async (db) => {
      const { rows } = await db.query('select id from agreements where application_id = $1', [
        applicationId,
      ]);
      expect(rows).toHaveLength(1);
      return rows[0].id as string;
    });

    // --- Mentor signs off a competency ------------------------------------------------------
    await page.goto(`/placements/${placementId}/sign-off`);
    await page.getByLabel('What did they demonstrate?').fill(
      'Terminated and tested a lighting circuit',
    );
    await page.getByRole('button', { name: 'Sign off competency' }).click();
    await expect(page.getByText('Competency signed')).toBeVisible();

    // --- It lands on the apprentice's Skill Passport, and they cannot edit it ---------------
    await signIn(page, apprentice.email);
    await page.goto('/passport');
    await expect(page.getByText('Terminated and tested a lighting circuit')).toBeVisible();
    await expect(page.getByText(/Signed by E2E Rahman Electric/)).toBeVisible();

    // Both parties can reach the same agreement, and the PDF downloads.
    const pdf = await page.request.get(`/agreements/${agreementId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
  });
});
