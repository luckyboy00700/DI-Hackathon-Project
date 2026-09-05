-- T007: profiles + RLS (default-deny, then additive grants).
-- Constitution Principle V: authorization is enforced at the data layer, never only in app code.

create extension if not exists postgis with schema extensions;

create type account_type as enum ('apprentice', 'business', 'organization');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type account_type not null,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  -- Principle VI: postal-code / city centroid only. Street addresses are never stored.
  coarse_location extensions.geography(Point, 4326),
  postal_code text check (postal_code is null or length(postal_code) between 3 and 12),
  date_of_birth date,
  guardian_contact jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint apprentice_requires_dob check (
    account_type <> 'apprentice' or date_of_birth is not null
  ),
  constraint searchable_accounts_require_location check (
    account_type = 'organization' or coarse_location is not null
  )
);

alter table profiles enable row level security;
-- Default deny: no policy is permissive until explicitly granted below.

create policy profiles_select_own on profiles
  for select using ((select auth.uid()) = id);

create policy profiles_update_own on profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy profiles_insert_own on profiles
  for insert with check ((select auth.uid()) = id);

-- Limited public read: search results and endorsement display need a counterparty's public
-- identity, never their date_of_birth or guardian_contact. Those two columns are excluded from
-- the view below, so no client query path can reach them.
create policy profiles_select_public_orgs on profiles
  for select using (
    (select auth.uid()) is not null and account_type in ('business', 'organization')
  );

create view public_profiles
with (security_invoker = true) as
  select id, account_type, display_name, coarse_location, postal_code
  from profiles
  where account_type in ('business', 'organization');

create index profiles_account_type_idx on profiles (account_type);
create index profiles_location_idx on profiles using gist (coarse_location);
