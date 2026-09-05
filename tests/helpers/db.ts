import { Client } from 'pg';

/**
 * Real-Postgres harness. Constitution Principle II forbids mocking the database for data-access
 * tests: RLS policies, CHECK constraints and transaction semantics only fail against a real
 * instance, and those are exactly the failures that leak private data.
 *
 * Requires `npm run db:start` (local Supabase stack).
 */

const connectionString =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/** Runs `fn` with the session acting as the given signed-in user, under their RLS policies. */
export async function asUser<T>(
  client: Client,
  userId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    await client.query("select set_config('role', 'authenticated', true)");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

/** Runs `fn` as the service role (bypasses RLS) — for arranging fixtures, never for assertions. */
export async function asService<T>(client: Client, fn: (client: Client) => Promise<T>): Promise<T> {
  await client.query('begin');
  try {
    await client.query("select set_config('role', 'postgres', true)");
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

let seq = 0;
/** Deterministic-ish unique suffix so parallel-safe fixtures don't collide across files. */
export function unique(prefix: string): string {
  seq += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${seq}`;
}

/** Creates an auth user + profile, returning the profile id. */
export async function createProfile(
  client: Client,
  input: {
    accountType: 'apprentice' | 'business' | 'organization';
    displayName?: string;
    dateOfBirth?: string;
    postalCode?: string;
    lon?: number;
    lat?: number;
  },
): Promise<string> {
  const email = `${unique('user')}@example.test`;
  const { rows } = await client.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', $1, '', now(), now(), now(), '', '', '', '')
     returning id`,
    [email],
  );
  const id = rows[0].id as string;

  const lon = input.lon ?? -83.05;
  const lat = input.lat ?? 42.33;
  await client.query(
    `insert into profiles (id, account_type, display_name, coarse_location, postal_code, date_of_birth)
     values ($1, $2, $3, extensions.ST_SetSRID(extensions.ST_MakePoint($4, $5), 4326)::extensions.geography, $6, $7)`,
    [
      id,
      input.accountType,
      input.displayName ?? `Test ${input.accountType}`,
      lon,
      lat,
      input.postalCode ?? '48201',
      input.dateOfBirth ?? null,
    ],
  );

  if (input.accountType === 'business') {
    await client.query(`insert into businesses (profile_id) values ($1)`, [id]);
  }
  if (input.accountType === 'organization') {
    await client.query(`insert into organizations (profile_id) values ($1)`, [id]);
  }
  return id;
}

/** Marks a business verified through the server-authoritative path. */
export async function verifyBusiness(
  client: Client,
  businessId: string,
  actorId: string,
): Promise<void> {
  await client.query("select set_config('app.verification_actor', $1, true)", [actorId]);
  await client.query(
    `update businesses set verification_status = 'verified' where profile_id = $1`,
    [businessId],
  );
  await client.query("select set_config('app.verification_actor', '', true)");
}
