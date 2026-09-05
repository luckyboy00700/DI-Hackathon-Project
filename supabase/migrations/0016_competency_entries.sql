-- T068: Skill Passport entries (FR-019 – FR-022). The "active placement" rule and the
-- mentor-only rule are RLS policies, not guard clauses in a Server Action.

create table competency_entries (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  placement_id uuid not null references placements (id) on delete cascade,
  mentor_id uuid not null references businesses (profile_id) on delete restrict,
  competency text not null check (length(trim(competency)) between 3 and 160),
  signed_at timestamptz not null default now()
);

alter table competency_entries enable row level security;

/**
 * A placement is active for sign-off when its application is accepted, has not been withdrawn
 * or terminated, has started, and has not yet run past its agreed duration (FR-022, and the
 * spec's "active placement" assumption).
 */
create or replace function application_is_active(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.status = 'accepted'
        and a.withdrawn_at is null
        and p.start_window_start <= current_date
        and current_date <= p.start_window_start + (p.duration_weeks * 7)
       from applications a
       join placements p on p.id = a.placement_id
      where a.id = p_application),
    false
  );
$$;

-- The apprentice and the mentor can both read the passport entries.
create policy competency_select_involved on competency_entries
  for select using (
    exists (
      select 1 from applications a
       join placements p on p.id = a.placement_id
      where a.id = competency_entries.application_id
        and (select auth.uid()) in (a.apprentice_id, p.business_id)
    )
  );

-- Only the placement's mentor may sign, and only while the placement is active.
create policy competency_insert_mentor_active on competency_entries
  for insert with check (
    (select auth.uid()) = mentor_id
    and exists (
      select 1 from applications a
       join placements p on p.id = a.placement_id
      where a.id = application_id
        and p.id = placement_id
        and p.business_id = (select auth.uid())
    )
    and application_is_active(application_id)
  );

-- FR-020: no update or delete policy exists for anyone. Immutable to the apprentice by
-- construction, not by convention.
create or replace function reject_competency_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'competency entries are immutable once signed (FR-020)'
    using errcode = 'check_violation';
end;
$$;

create trigger competency_no_update
  before update or delete on competency_entries
  for each row execute function reject_competency_mutation();

create index competency_application_idx on competency_entries (application_id, signed_at desc);

/** T071: read-only Skill Passport share link, resolved by an unguessable token. */
alter table profiles add column passport_share_token uuid unique default gen_random_uuid();

/**
 * Returns a passport by share token: competencies, mentor and date only. No contact details,
 * no date of birth, no application ids (FR-021, Principle VI).
 */
create or replace function passport_by_token(p_token uuid)
returns table (
  apprentice_name text,
  competency text,
  mentor_name text,
  trade_category trade_category,
  signed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ap.display_name, ce.competency, bp.display_name, p.trade_category, ce.signed_at
    from profiles ap
    join applications a on a.apprentice_id = ap.id
    join competency_entries ce on ce.application_id = a.id
    join placements p on p.id = ce.placement_id
    join profiles bp on bp.id = ce.mentor_id
   where ap.passport_share_token = p_token
   order by ce.signed_at desc;
$$;
