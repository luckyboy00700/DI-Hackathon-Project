-- T016: demo data at ~10x pilot scale (plan.md Risks: "a geo search demo with three seeded rows
-- proves nothing"). Generated rather than hand-written so the p95 search measurement is real.

set search_path = public, extensions;

-- Password hashing for demo accounts (email + password auth — see lib/auth/session.ts).
create extension if not exists pgcrypto with schema extensions;

-- Deterministic demo accounts (referenced by quickstart.md and the E2E specs). Every seeded
-- account shares one demo password.
create or replace function seed_user(p_email text, p_password text)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  -- GoTrue scans these token columns into non-nullable strings; leaving them NULL breaks
  -- every later auth lookup with "Database error finding user".
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values (new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')), now(), now(), now(), '', '', '', '');
  return new_id;
end;
$$;

do $$
declare
  ops_id uuid;
  business_id uuid;
  unverified_id uuid;
  minor_id uuid;
  adult_id uuid;
  i int;
  b_id uuid;
  regions text[] := array['US-MI', 'US-OH', 'US-IL', 'US-IN', 'US-NY', 'US-TX'];
  trades trade_category[] := array['electrical','plumbing','carpentry','hvac','welding','masonry',
    'automotive','landscaping','print_design','photography','videography','upholstery']::trade_category[];
  hazards age_restriction_category[] := array['none','none','none','heavy_equipment',
    'high_voltage','confined_space']::age_restriction_category[];
begin
  -- Vouching organization / ops actor. Bootstrapped as already-verified: it is the network's
  -- first trusted node, the same way a real pilot would manually seed one founding masjid before
  -- any peer-review chain can start.
  ops_id := seed_user('masjid.alnoor@example.test', 'amanah123');
  insert into profiles (id, account_type, display_name, coarse_location, postal_code)
  values (ops_id, 'organization', 'Masjid Al-Noor Community Hub',
    ST_SetSRID(ST_MakePoint(-83.05, 42.33), 4326)::geography, '48201');
  insert into organizations (profile_id, verification_status, verified_by, verified_at)
  values (ops_id, 'verified', ops_id, now());

  -- Verified demo business
  business_id := seed_user('rahman.electric@example.test', 'amanah123');
  insert into profiles (id, account_type, display_name, coarse_location, postal_code)
  values (business_id, 'business', 'Rahman Electric',
    ST_SetSRID(ST_MakePoint(-83.06, 42.34), 4326)::geography, '48202');
  insert into businesses (profile_id, trade_categories) values (business_id, '{electrical}');
  perform record_verification_decision(business_id, ops_id, 'verified');

  -- Unverified demo business (used to demo the publishing gate)
  unverified_id := seed_user('newshop@example.test', 'amanah123');
  insert into profiles (id, account_type, display_name, coarse_location, postal_code)
  values (unverified_id, 'business', 'Northside Woodworks (unverified)',
    ST_SetSRID(ST_MakePoint(-83.10, 42.36), 4326)::geography, '48203');
  insert into businesses (profile_id, trade_categories) values (unverified_id, '{carpentry}');

  -- Demo apprentices: one minor (Yusuf, the spec's primary journey) and one adult
  minor_id := seed_user('yusuf@example.test', 'amanah123');
  insert into profiles (id, account_type, display_name, coarse_location, postal_code, date_of_birth,
    guardian_contact)
  values (minor_id, 'apprentice', 'Yusuf A.',
    ST_SetSRID(ST_MakePoint(-83.04, 42.32), 4326)::geography, '48201', '2009-03-14',
    '{"name": "Guardian A.", "email": "guardian@example.test"}'::jsonb);

  adult_id := seed_user('amina@example.test', 'amanah123');
  insert into profiles (id, account_type, display_name, coarse_location, postal_code, date_of_birth)
  values (adult_id, 'apprentice', 'Amina S.',
    ST_SetSRID(ST_MakePoint(-83.08, 42.30), 4326)::geography, '48204', '2005-11-02');

  -- Community vouches (FR-004/FR-005): the masjid vouching for members it knows personally, so
  -- the Action Center's references list has real rows rather than an empty demo.
  insert into endorsements (organization_id, subject_type, apprentice_subject_id)
  values (ops_id, 'apprentice', minor_id), (ops_id, 'apprentice', adult_id);
  insert into endorsements (organization_id, subject_type, business_subject_id)
  values (ops_id, 'business', business_id);

  -- ~10x pilot scale: 40 verified businesses, 300 open placements spread over the metro area.
  for i in 1..40 loop
    b_id := seed_user(format('business%s@example.test', i), 'amanah123');
    insert into profiles (id, account_type, display_name, coarse_location, postal_code)
    values (b_id, 'business', format('Demo Trade Co. %s', i),
      ST_SetSRID(ST_MakePoint(-83.05 + (random() - 0.5) * 0.6, 42.33 + (random() - 0.5) * 0.6),
        4326)::geography,
      '482' || lpad((i % 99)::text, 2, '0'));
    insert into businesses (profile_id, trade_categories)
    values (b_id, array[trades[1 + (i % 12)]]);
    perform record_verification_decision(b_id, ops_id, 'verified');

    insert into placements (business_id, trade_category, description, coarse_location, postal_code,
      region, duration_weeks, weekly_hours, hourly_rate, capacity, start_window_start,
      start_window_end, age_restriction_category, status)
    select
      b_id,
      trades[1 + ((i + g) % 12)],
      format('Summer apprenticeship %s: hands-on work alongside an experienced practitioner.', g),
      ST_SetSRID(ST_MakePoint(-83.05 + (random() - 0.5) * 0.8, 42.33 + (random() - 0.5) * 0.8),
        4326)::geography,
      '482' || lpad(((i + g) % 99)::text, 2, '0'),
      'US-MI',
      6 + ((i + g) % 8),
      15 + ((i + g) % 20),
      16.00 + ((i + g) % 14),
      1 + ((i + g) % 3),
      date '2026-06-01' + ((i + g) % 45),
      date '2026-06-15' + ((i + g) % 45),
      hazards[1 + ((i + g) % 6)],
      'open'
    from generate_series(1, 8) as g;
  end loop;
end $$;

drop function seed_user(text, text);
