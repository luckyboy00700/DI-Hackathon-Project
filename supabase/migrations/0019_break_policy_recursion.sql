/**
 * Breaks an infinite recursion between row-level policies.
 *
 * profiles_select_own_applicants (0017) reads applications; applications_select_for_own_placement
 * (0010) reads placements; placements_select_own_application (0018) reads applications again.
 * Each policy's subquery is itself subject to RLS, so evaluating any of them re-entered the
 * cycle and Postgres aborted with "infinite recursion detected in policy for relation".
 *
 * The fix is the standard one: move each relationship test into a SECURITY DEFINER function.
 * The function answers the relationship question directly, without re-entering the policies, so
 * the predicates stay in the data layer (Principle V) without referring to one another.
 */

create or replace function is_applicant_of_caller(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from applications a
      join placements p on p.id = a.placement_id
     where a.apprentice_id = p_profile
       and p.business_id = (select auth.uid())
  );
$$;

create or replace function caller_applied_to_placement(p_placement uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from applications a
     where a.placement_id = p_placement
       and a.apprentice_id = (select auth.uid())
  );
$$;

create or replace function caller_owns_placement_of_application(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from applications a
      join placements p on p.id = a.placement_id
     where a.id = p_application
       and p.business_id = (select auth.uid())
  );
$$;

drop policy if exists profiles_select_own_applicants on profiles;
create policy profiles_select_own_applicants on profiles
  for select using (is_applicant_of_caller(profiles.id));

drop policy if exists placements_select_own_application on placements;
create policy placements_select_own_application on placements
  for select using (caller_applied_to_placement(placements.id));

drop policy if exists applications_select_for_own_placement on applications;
create policy applications_select_for_own_placement on applications
  for select using (caller_owns_placement_of_application(applications.id));
