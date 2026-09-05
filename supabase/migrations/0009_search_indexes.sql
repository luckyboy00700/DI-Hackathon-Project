-- T034/T035: proximity search. Age gating (FR-010) lives in the SQL predicate, never in a
-- component — constitution Principle V: client-side filtering alone is a blocking defect.

create index placements_location_idx on placements using gist (coarse_location);

/**
 * Returns open placements from verified businesses within p_distance_km of the CALLER's own
 * coarse location, excluding age-restricted placements when the caller will be under 18 on the
 * placement's start date. Ordered by proximity (FR-009), paginated server-side (Principle IV).
 *
 * security invoker: RLS still applies on top of this predicate, so the function cannot widen
 * what the caller is allowed to see.
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
security invoker
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
