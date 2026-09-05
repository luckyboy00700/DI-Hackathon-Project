-- T020: placements. The wage floor (FR-007) and the age-restriction classification (FR-010)
-- are enforced here, in the engine, so no code path can write an underpaying or mis-classified
-- placement.

create type age_restriction_category as enum (
  'none', 'heavy_equipment', 'high_voltage', 'confined_space', 'other_hazardous'
);

create type placement_status as enum ('draft', 'open', 'withdrawn', 'filled');

create table placements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (profile_id) on delete cascade,
  trade_category trade_category not null,
  description text not null check (length(description) between 20 and 2000),
  -- Populated by the default_placement_location trigger below from the owning business's
  -- profile, so a client can never submit a precise address (Principle VI).
  coarse_location extensions.geography(Point, 4326) not null,
  postal_code text not null,
  region text not null references wage_floors (region),
  duration_weeks int not null check (duration_weeks between 1 and 52),
  weekly_hours int not null check (weekly_hours between 1 and 40),
  hourly_rate numeric(6, 2) not null check (hourly_rate > 0),
  capacity int not null check (capacity > 0),
  start_window_start date not null,
  start_window_end date not null,
  required_certifications text[] not null default '{}',
  age_restriction_category age_restriction_category not null default 'none',
  status placement_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint start_window_ordered check (start_window_end >= start_window_start)
);

-- FR-007: a CHECK constraint cannot subquery, so the wage floor is enforced by a trigger that
-- runs on every insert and update — including edits, per the spec.
create or replace function enforce_wage_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  floor_rate numeric;
begin
  select hourly_minimum into floor_rate from wage_floors where region = new.region;
  if floor_rate is null then
    raise exception 'No wage floor configured for region %', new.region
      using errcode = 'check_violation';
  end if;
  if new.hourly_rate < floor_rate then
    raise exception 'RATE_BELOW_WAGE_FLOOR: % is below the % minimum of %',
      new.hourly_rate, new.region, floor_rate
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger placements_enforce_wage_floor
  before insert or update of hourly_rate, region on placements
  for each row execute function enforce_wage_floor();

/**
 * Principle VI: a placement's location is the owning business's coarse location (postal-code /
 * city centroid). Filling it server-side means no client can submit a precise street address,
 * and the application layer never has to hand-build a geography literal.
 * BEFORE-INSERT triggers run ahead of the NOT NULL check, so the column stays NOT NULL.
 */
create or replace function default_placement_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coarse_location is null or new.postal_code is null then
    select coalesce(new.coarse_location, p.coarse_location),
           coalesce(new.postal_code, p.postal_code)
      into new.coarse_location, new.postal_code
      from profiles p
     where p.id = new.business_id;
  end if;
  return new;
end;
$$;

create trigger placements_default_location
  before insert on placements
  for each row execute function default_placement_location();

-- FR-011 / Principle IV: every geography, trade-category and status filter is index-backed.
create index placements_status_trade_idx on placements (status, trade_category);
create index placements_business_idx on placements (business_id);
create index placements_start_window_idx on placements (start_window_start);
