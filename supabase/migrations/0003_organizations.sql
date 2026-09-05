-- T009: vouching organizations (masjid / civic hub acting as a reference node).
-- No extra identity fields beyond profiles: a named reference is all FR-005 needs.

create table organizations (
  profile_id uuid primary key references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;

create policy organizations_select_authenticated on organizations
  for select using ((select auth.uid()) is not null);

create policy organizations_insert_own on organizations
  for insert with check ((select auth.uid()) = profile_id);

-- An organization may also operate a business account. The two are distinct accounts (spec
-- Assumptions), linked here so self-endorsement (FR-004) stays a simple ownership lookup.
create table organization_operated_businesses (
  organization_id uuid not null references organizations (profile_id) on delete cascade,
  business_id uuid not null references businesses (profile_id) on delete cascade,
  primary key (organization_id, business_id)
);

alter table organization_operated_businesses enable row level security;

create policy org_operated_select_authenticated on organization_operated_businesses
  for select using ((select auth.uid()) is not null);
