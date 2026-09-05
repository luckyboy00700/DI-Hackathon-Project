-- T050: agreements (FR-016). One per accepted application, immutable once issued.

create table agreements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications (id) on delete cascade,
  duration_weeks int not null,
  weekly_hours int not null,
  hourly_rate numeric(6, 2) not null,
  total_estimated_hours int not null,
  estimated_gross_pay numeric(10, 2) not null,
  mentorship_milestones jsonb not null,
  safety_obligations jsonb not null,
  termination_terms text not null,
  generated_at timestamptz not null default now()
);

alter table agreements enable row level security;

-- Both parties to the placement read the SAME row — that is what makes the copies identical.
create policy agreements_select_involved on agreements
  for select using (
    exists (
      select 1 from applications a
       join placements p on p.id = a.placement_id
      where a.id = agreements.application_id
        and (select auth.uid()) in (a.apprentice_id, p.business_id)
    )
  );

-- No insert/update/delete policy: rows are created only by accept_application() (0014), which
-- runs as security definer. Immutable once issued.
create or replace function reject_agreement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'agreements are immutable once issued (FR-016)' using errcode = 'check_violation';
end;
$$;

create trigger agreements_no_update
  before update or delete on agreements
  for each row execute function reject_agreement_mutation();
