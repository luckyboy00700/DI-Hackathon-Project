-- A mentor must be able to see WHO applied to their placement to make a decision, but must not
-- learn the applicant's date of birth or guardian contact. Row access and column access are
-- tightened separately here.

-- Row access: a business may read the profile rows of apprentices who applied to its placements.
create policy profiles_select_own_applicants on profiles
  for select using (
    exists (
      select 1
        from applications a
        join placements p on p.id = a.placement_id
       where a.apprentice_id = profiles.id
         and p.business_id = (select auth.uid())
    )
  );

/**
 * Column access: date_of_birth and guardian_contact are removed from every client role. They
 * exist only to decide eligibility, and that decision is made by security-definer functions
 * (application_needs_guardian_consent, search_placements) — never by returning the raw value.
 * Principle VI: the safest way to not leak a field is to make it unreadable.
 */
revoke select (date_of_birth, guardian_contact) on profiles from authenticated;

/**
 * search_placements reads the caller's own date_of_birth for the FR-010 age gate, so it becomes
 * security definer now that the column is revoked. Its viewer CTE is pinned to auth.uid() and it
 * still only ever returns open placements from verified businesses, so this does not widen what
 * a caller can see.
 */
create or replace function search_placements(
  p_distance_km numeric,
  p_trade trade_category default null,
  p_min_weeks int default null,
  p_max_weeks int default null,
  p_min_weekly_hours int default null,
  p_max_weekly_hours int default null,
  p_start_after date default null,
  p_start_before date default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  placement_id uuid,
  business_name text,
  trade_category trade_category,
  distance_km numeric,
  hourly_rate numeric,
  weekly_hours int,
  duration_weeks int,
  start_window_start date,
  start_window_end date,
  age_restriction_category age_restriction_category,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with viewer as (
    select coarse_location, date_of_birth
      from profiles
     where id = (select auth.uid())
  ),
  matched as (
    select
      p.id,
      bp.display_name as business_name,
      p.trade_category,
      round((ST_Distance(p.coarse_location, v.coarse_location) / 1000)::numeric, 1) as distance_km,
      p.hourly_rate,
      p.weekly_hours,
      p.duration_weeks,
      p.start_window_start,
      p.start_window_end,
      p.age_restriction_category
    from placements p
    join profiles bp on bp.id = p.business_id
    join businesses b on b.profile_id = p.business_id
    cross join viewer v
    where p.status = 'open'
      and b.verification_status = 'verified'
      and ST_DWithin(p.coarse_location, v.coarse_location, p_distance_km * 1000)
      and (p_trade is null or p.trade_category = p_trade)
      and (p_min_weeks is null or p.duration_weeks >= p_min_weeks)
      and (p_max_weeks is null or p.duration_weeks <= p_max_weeks)
      and (p_min_weekly_hours is null or p.weekly_hours >= p_min_weekly_hours)
      and (p_max_weekly_hours is null or p.weekly_hours <= p_max_weekly_hours)
      and (p_start_after is null or p.start_window_start >= p_start_after)
      and (p_start_before is null or p.start_window_start <= p_start_before)
      and (
        p.age_restriction_category = 'none'
        or v.date_of_birth is null
        or p.start_window_start >= (v.date_of_birth + interval '18 years')::date
      )
  )
  select m.*, count(*) over () as total_count
    from matched m
   order by m.distance_km asc, m.id asc
   limit p_page_size
  offset greatest(p_page - 1, 0) * p_page_size;
$$;

-- guardian_consents policies subquery other RLS-protected tables; as a definer helper this
-- resolves consistently for both parties rather than depending on nested policy evaluation.
create or replace function application_has_guardian_consent(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from guardian_consents where application_id = p_application);
$$;
