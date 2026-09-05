-- T075: community endorsements (FR-004, FR-005).
-- Note: tasks.md pencilled this in as migration 0017; three fixes landed in 0017-0019 first,
-- so it is 0020. Contents are unchanged from data-model.md.

create type endorsement_subject_type as enum ('apprentice', 'business');

create table endorsements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (profile_id) on delete cascade,
  subject_type endorsement_subject_type not null,
  -- A single polymorphic uuid cannot carry a foreign key. Two nullable, individually-FK'd
  -- columns plus the CHECK below keep referential integrity a native constraint.
  apprentice_subject_id uuid references profiles (id) on delete cascade,
  business_subject_id uuid references businesses (profile_id) on delete cascade,
  -- FR-005 / Principle VI: a decision and a named organization. There is deliberately NO column
  -- for free-text character assessment about a person — it cannot be stored because it does not
  -- exist in the schema.
  decision text not null default 'endorsed' check (decision = 'endorsed'),
  created_at timestamptz not null default now(),

  constraint endorsement_subject_matches_type check (
    (subject_type = 'apprentice'
       and apprentice_subject_id is not null and business_subject_id is null)
    or
    (subject_type = 'business'
       and business_subject_id is not null and apprentice_subject_id is null)
  ),

  -- One standing endorsement per organization per subject.
  constraint endorsement_unique_apprentice unique (organization_id, apprentice_subject_id),
  constraint endorsement_unique_business unique (organization_id, business_subject_id)
);

alter table endorsements enable row level security;

/** True when the caller's organization may not endorse this business (FR-004). */
create or replace function caller_operates_business(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_operated_businesses o
     where o.organization_id = (select auth.uid())
       and o.business_id = p_business
  );
$$;

-- Endorsements are visible to everyone signed in: that is the point of a named reference.
create policy endorsements_select_authenticated on endorsements
  for select using ((select auth.uid()) is not null);

-- Self-endorsement is refused by the policy itself, so no application code path can create one.
create policy endorsements_insert_own_org on endorsements
  for insert with check (
    (select auth.uid()) = organization_id
    and coalesce(apprentice_subject_id, business_subject_id) <> (select auth.uid())
    and (business_subject_id is null or not caller_operates_business(business_subject_id))
  );

create index endorsements_apprentice_idx on endorsements (apprentice_subject_id);
create index endorsements_business_idx on endorsements (business_subject_id);
