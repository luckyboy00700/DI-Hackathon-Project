-- Masjid / community-hub filter: an organization already vouches for the businesses it verifies
-- (businesses.verified_by, 0008). This lets a caller subset placements to only those routed
-- through a chosen local masjid, and lists which masjids actually have verified offers to show.

-- Adding a trailing parameter changes the function's identity (name + arg types), so
-- create-or-replace would leave the old 10-arg overload in place and make every call ambiguous.
-- The old signature must be dropped explicitly first.
drop function if exists search_placements(
  numeric, trade_category, int, int, int, int, date, date, int, int
);

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
  p_page_size int default 20,
  p_organization_id uuid default null
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
-- date_of_birth is revoked from `authenticated` (0017): this must stay security definer, pinned
-- to the caller's own auth.uid(), or every call fails with "permission denied for table profiles".
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
      -- Masjid subsetting: only placements from businesses that this organization verified.
      and (p_organization_id is null or b.verified_by = p_organization_id)
      -- FR-010: age evaluated at the placement START DATE, not today. Mirrors
      -- lib/domain/eligibility.ts exactly: the 18th birthday must fall on or before the start.
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

/**
 * Local masjids/community hubs with at least one verified business on the board, nearest to the
 * caller first. security invoker: the same profiles RLS that already gates organization
 * visibility (0001) applies here, so an anonymous caller sees none — same rule as everywhere else.
 */
create or replace function list_verifying_organizations(p_distance_km numeric default 100)
returns table (
  organization_id uuid,
  display_name text,
  distance_km numeric
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with viewer as (
    select coarse_location from profiles where id = (select auth.uid())
  )
  select
    o.id,
    o.display_name,
    case
      when v.coarse_location is null or o.coarse_location is null then null
      else round((ST_Distance(o.coarse_location, v.coarse_location) / 1000)::numeric, 1)
    end as distance_km
  from profiles o
  cross join viewer v
  where o.account_type = 'organization'
    and exists (
      select 1 from businesses b
       where b.verified_by = o.id and b.verification_status = 'verified'
    )
    and (
      v.coarse_location is null
      or o.coarse_location is null
      or ST_DWithin(o.coarse_location, v.coarse_location, p_distance_km * 1000)
    )
  order by distance_km asc nulls last, o.display_name asc;
$$;
