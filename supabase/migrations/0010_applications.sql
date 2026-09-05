-- T048: applications. FR-013 (no duplicates) is a unique index, not a conditional check — the
-- race between two submissions is structurally impossible rather than narrowly avoided.

create type application_status as enum (
  'submitted', 'under_review', 'accepted', 'declined', 'withdrawn'
);

create type withdrawal_reason_category as enum (
  'apprentice_withdrew', 'business_terminated', 'mutual', 'other'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references placements (id) on delete cascade,
  apprentice_id uuid not null references profiles (id) on delete cascade,
  availability text not null,
  experience text not null default '',
  statement text not null,
  status application_status not null default 'submitted',
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  withdrawal_reason_category withdrawal_reason_category,
  withdrawn_by uuid references profiles (id) on delete set null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FR-013.
create unique index applications_one_per_placement on applications (placement_id, apprentice_id);
create index applications_placement_status_idx on applications (placement_id, status);
create index applications_apprentice_idx on applications (apprentice_id, created_at desc);

alter table applications enable row level security;

create policy applications_select_own on applications
  for select using ((select auth.uid()) = apprentice_id);

-- The mentor sees applications to their own placements.
create policy applications_select_for_own_placement on applications
  for select using (
    exists (
      select 1 from placements p
       where p.id = applications.placement_id and p.business_id = (select auth.uid())
    )
  );

create policy applications_insert_own on applications
  for insert with check (
    (select auth.uid()) = apprentice_id
    -- Cannot apply to a placement that is not open (FR-012).
    and exists (
      select 1 from placements p
       where p.id = placement_id and p.status = 'open' and is_verified_business(p.business_id)
    )
  );

-- Status transitions go through the transaction functions in 0014/0015, which run as
-- security definer. Direct client updates are limited to the apprentice's own draft fields.
create policy applications_update_own_before_decision on applications
  for update using (
    (select auth.uid()) = apprentice_id and status in ('submitted', 'under_review')
  )
  with check ((select auth.uid()) = apprentice_id);
