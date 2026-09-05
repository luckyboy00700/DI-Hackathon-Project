import { expect, test } from '@playwright/test';
import { seedAccount, signIn, withDb } from './helpers';

/**
 * T080 — demo-critical flow 1: an unverified business is blocked from publishing, and publishing
 * succeeds once verified. Covers the primary success path AND the primary failure path, which is
 * what constitution Principle II asks of each named flow.
 */

test.describe('publish gating (User Story 1)', () => {
  test('unverified business is blocked, then publishes once verified', async ({ page }) => {
    const business = await seedAccount({
      accountType: 'business',
      displayName: 'E2E Woodworks',
    });

    await signIn(page, business.email);

    // --- Failure path: unverified business cannot publish -------------------------------
    await page.goto('/placements');
    await expect(
      page.getByRole('heading', { name: 'Your business is not verified yet' }),
    ).toBeVisible();

    await page.goto('/placements/new');
    await page.getByLabel('What the apprentice will do').fill(
      'Bench joinery and site fitting alongside a working carpenter for the summer.',
    );
    await page.getByLabel('Trade').selectOption('carpentry');
    await page.getByRole('button', { name: 'Save placement' }).click();

    await expect(page.getByText('Saved as a draft, not published')).toBeVisible();

    await page.goto('/placements');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByText(/not visible to apprentices/i)).toBeVisible();

    // --- Verification is server-authoritative, never set from the client -----------------
    await withDb(async (db) => {
      const ops = await db.query(`select profile_id from organizations limit 1`);
      await db.query('select record_verification_decision($1, $2, $3)', [
        business.id,
        ops.rows[0].profile_id,
        'verified',
      ]);
    });

    // --- Success path: the same business can now publish ---------------------------------
    await page.goto('/placements/new');
    await page.getByLabel('What the apprentice will do').fill(
      'Finish carpentry on residential remodels, mentored throughout the placement.',
    );
    await page.getByLabel('Trade').selectOption('carpentry');
    await page.getByRole('button', { name: 'Save placement' }).click();

    await expect(page.getByText('Placement published')).toBeVisible();

    await page.goto('/placements');
    await expect(page.getByText('Live in search')).toBeVisible();
  });

  test('a placement under the regional wage floor is refused with the floor stated', async ({
    page,
  }) => {
    const business = await seedAccount({
      accountType: 'business',
      displayName: 'E2E Underpayers',
      verified: true,
    });
    await signIn(page, business.email);

    await page.goto('/placements/new');
    await page.getByLabel('What the apprentice will do').fill(
      'General labouring support on residential jobs across the summer season.',
    );
    await page.getByLabel('Region').selectOption('US-IL'); // floor is 15.00
    await page.getByLabel('Hourly rate (USD)').fill('9');
    await page.getByRole('button', { name: 'Save placement' }).click();

    await expect(page.getByText(/below the legal minimum/i)).toBeVisible();
  });
});
