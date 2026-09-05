-- T021: placement RLS. FR-002 (only verified businesses publish) and FR-011 (searchers see only
-- open placements from verified businesses) are enforced as policies, not as view logic.

alter table placements enable row level security;

create or replace function is_verified_business(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from businesses
    where profile_id = p_business and verification_status = 'verified'
  );
$$;

-- Owners see all their own placements, including drafts.
create policy placements_select_own on placements
  for select using ((select auth.uid()) = business_id);

-- Everyone else sees only open placements from currently-verified businesses.
create policy placements_select_open_verified on placements
  for select using (
    status = 'open'
    and is_verified_business(business_id)
    and (select auth.uid()) is not null
  );

create policy placements_insert_own on placements
  for insert with check (
    (select auth.uid()) = business_id
    -- A draft may be created while unverified; publishing is what requires verification.
    and (status = 'draft' or is_verified_business(business_id))
  );

create policy placements_update_own on placements
  for update using ((select auth.uid()) = business_id)
  with check (
    (select auth.uid()) = business_id
    and (status <> 'open' or is_verified_business(business_id))
  );
