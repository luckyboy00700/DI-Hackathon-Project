-- T010: per-region wage floors (research.md decision 1). Reference data, not user-editable.

create table wage_floors (
  region text primary key,
  hourly_minimum numeric(6, 2) not null check (hourly_minimum > 0),
  effective_date date not null default current_date
);

alter table wage_floors enable row level security;

-- Readable by anyone signed in (the placement form shows the applicable floor); writable by
-- nobody through the client — seeded by migration/ops only.
create policy wage_floors_select_authenticated on wage_floors
  for select using ((select auth.uid()) is not null);

insert into wage_floors (region, hourly_minimum, effective_date) values
  ('US-MI', 12.48, '2026-01-01'),
  ('US-OH', 10.70, '2026-01-01'),
  ('US-IL', 15.00, '2026-01-01'),
  ('US-IN', 7.25, '2026-01-01'),
  ('US-NY', 16.50, '2026-01-01'),
  ('US-TX', 7.25, '2026-01-01');

-- Resolves the floor for a region; used by the placements CHECK trigger (FR-007).
create or replace function wage_floor_for_region(p_region text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select hourly_minimum from wage_floors where region = p_region;
$$;
