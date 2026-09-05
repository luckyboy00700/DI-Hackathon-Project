import type { Page } from '@playwright/test';
import { Client } from 'pg';

/**
 * E2E support. Sign-in goes through the REAL email-OTP flow: the app sends a code, the local
 * mail catcher (Mailpit, part of the Supabase stack) receives it, and we read it back the way a
 * user would read their inbox. No test-only auth bypass, so the login path is genuinely covered.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

type MailpitMessage = { ID: string; To: { Address: string }[]; Created: string };

async function latestMessageFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const listed = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    if (listed.ok) {
      const body = (await listed.json()) as { messages?: MailpitMessage[] };
      const match = (body.messages ?? []).find((m) =>
        m.To?.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
      );
      if (match) {
        const detail = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);
        const content = (await detail.json()) as { Text?: string; HTML?: string };
        const code = `${content.Text ?? ''}${content.HTML ?? ''}`.match(/\b(\d{6})\b/);
        if (code) return code[1]!;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`No sign-in code arrived for ${email}`);
}

/** Clears the inbox so a stale code from a previous test is never picked up. */
export async function clearInbox(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => undefined);
}

export async function signIn(page: Page, email: string): Promise<void> {
  await clearInbox();
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();

  const code = await latestMessageFor(email);
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Assert we actually left the sign-in page. A glob like '**/' also matches '/signin', which
  // let a failed sign-in slip through and surface later as a confusing redirect.
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 15_000 });
}

/** Creates a fresh account of the given type and returns its email. */
export async function seedAccount(input: {
  accountType: 'apprentice' | 'business' | 'organization';
  displayName: string;
  dateOfBirth?: string;
  verified?: boolean;
}): Promise<{ email: string; id: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

  return withDb(async (db) => {
    const { rows } = await db.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
         'authenticated', $1, '', now(), now(), now(), '', '', '', '')
       returning id`,
      [email],
    );
    const id = rows[0].id as string;

    await db.query(
      `insert into profiles (id, account_type, display_name, coarse_location, postal_code, date_of_birth)
       values ($1, $2, $3,
         extensions.ST_SetSRID(extensions.ST_MakePoint(-83.05, 42.33), 4326)::extensions.geography,
         '48201', $4)`,
      [id, input.accountType, input.displayName, input.dateOfBirth ?? null],
    );

    if (input.accountType === 'business') {
      await db.query(`insert into businesses (profile_id, trade_categories) values ($1, '{carpentry}')`, [id]);
    }
    if (input.accountType === 'organization') {
      await db.query(`insert into organizations (profile_id) values ($1)`, [id]);
    }

    if (input.verified) {
      const ops = await db.query(`select profile_id from organizations limit 1`);
      await db.query('select record_verification_decision($1, $2, $3)', [
        id,
        ops.rows[0]?.profile_id ?? id,
        'verified',
      ]);
    }

    return { email, id };
  });
}
