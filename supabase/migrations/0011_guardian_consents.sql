-- T049: guardian consent (FR-014). An uploaded, signed document — research.md decision 2.

create table guardian_consents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications (id) on delete cascade,
  document_path text not null,
  recorded_by uuid not null references profiles (id) on delete restrict,
  recorded_at timestamptz not null default now()
);

alter table guardian_consents enable row level security;

create policy guardian_consents_select_involved on guardian_consents
  for select using (
    exists (
      select 1 from applications a
       join placements p on p.id = a.placement_id
      where a.id = guardian_consents.application_id
        and (select auth.uid()) in (a.apprentice_id, p.business_id)
    )
  );

-- The apprentice (or a guardian acting through their session) records the consent artifact.
create policy guardian_consents_insert_own_application on guardian_consents
  for insert with check (
    exists (
      select 1 from applications a
       where a.id = application_id and a.apprentice_id = (select auth.uid())
    )
  );

-- Private bucket: consent documents are never publicly readable.
insert into storage.buckets (id, name, public)
values ('guardian-consents', 'guardian-consents', false)
on conflict (id) do nothing;

create policy "guardian consent upload own"
  on storage.objects for insert
  with check (bucket_id = 'guardian-consents' and (select auth.uid()) is not null);

create policy "guardian consent read own"
  on storage.objects for select
  using (bucket_id = 'guardian-consents' and (select auth.uid())::text = (storage.foldername(name))[1]);

/** True when the applicant is under 18 on the placement's start date (FR-010 semantics). */
create or replace function application_needs_guardian_consent(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.start_window_start < (pr.date_of_birth + interval '18 years')::date
       from applications a
       join placements p on p.id = a.placement_id
       join profiles pr on pr.id = a.apprentice_id
      where a.id = p_application),
    false
  );
$$;
