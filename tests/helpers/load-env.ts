/**
 * Loads the local Supabase connection settings for integration/contract tests.
 * Defaults match `supabase/config.toml`, so `npm run db:start` is the only prerequisite.
 */
process.env.SUPABASE_DB_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
