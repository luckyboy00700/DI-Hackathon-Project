-- Business verification documents (trade certs, licenses, insurance, proof of business) and
-- apprentice documents (liability waivers, volunteer hour logs — guardian consent already has
-- its own table, 0011). Plus a masjid "master directory" view over data that already exists.

create type business_document_type as enum (
  'trade_certification', 'business_license', 'insurance', 'proof_of_business'
);

create table business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (profile_id) on delete cascade,
  document_type business_document_type not null,
  label text not null check (length(trim(label)) between 2 and 120),
  document_path text not null,
  expires_on date,
  uploaded_at timestamptz not null default now()
);

alter table business_documents enable row level security;

-- Open read, same as organization_certifications (0022): a business's credentials are the
-- public claim other members rely on to trust it, not private data.
create policy business_documents_select_authenticated on business_documents
  for select using ((select auth.uid()) is not null);

create policy business_documents_insert_own on business_documents
  for insert with check ((select auth.uid()) = business_id);

create policy business_documents_delete_own on business_documents
  for delete using ((select auth.uid()) = business_id);

insert into storage.buckets (id, name, public)
values ('business-documents', 'business-documents', false)
on conflict (id) do nothing;

create policy "business document upload own" on storage.objects
  for insert with check (bucket_id = 'business-documents' and (select auth.uid()) is not null);

create policy "business document read authenticated" on storage.objects
  for select using (bucket_id = 'business-documents' and (select auth.uid()) is not null);

create index business_documents_business_idx on business_documents (business_id, document_type);

-- Apprentice documents. Kept PRIVATE (uploader-only read) unlike business_documents — these can
-- concern a minor. A mentor entitled to see one (accepted application) gets it through a
-- server-generated signed URL, the same pattern already used for organization certifications.
create type apprentice_document_type as enum ('liability_waiver', 'volunteer_hours_log');

create table apprentice_documents (
  id uuid primary key default gen_random_uuid(),
  apprentice_id uuid not null references profiles (id) on delete cascade,
  application_id uuid references applications (id) on delete cascade,
  document_type apprentice_document_type not null,
  document_path text not null,
  note text check (note is null or length(note) <= 500),
  uploaded_at timestamptz not null default now()
);

alter table apprentice_documents enable row level security;

create policy apprentice_documents_select_involved on apprentice_documents
  for select using (
    (select auth.uid()) = apprentice_id
    or exists (
      select 1 from applications a
       join placements p on p.id = a.placement_id
      where a.id = apprentice_documents.application_id
        and p.business_id = (select auth.uid())
    )
  );

create policy apprentice_documents_insert_own on apprentice_documents
  for insert with check ((select auth.uid()) = apprentice_id);

insert into storage.buckets (id, name, public)
values ('apprentice-documents', 'apprentice-documents', false)
on conflict (id) do nothing;

create policy "apprentice document upload own" on storage.objects
  for insert with check (bucket_id = 'apprentice-documents' and (select auth.uid()) is not null);

create policy "apprentice document read own" on storage.objects
  for select using (
    bucket_id = 'apprentice-documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create index apprentice_documents_apprentice_idx on apprentice_documents (apprentice_id, document_type);
create index apprentice_documents_application_idx on apprentice_documents (application_id);

-- Masjid master directory. The view below is security_invoker, so it is only as wide as the
-- underlying tables' own RLS — and today neither placements nor applications grant a masjid
-- visibility into a verified business's non-open placements or its applicants. These two
-- policies are the actual grant; the view is just a convenience projection over them.
create policy placements_select_verified_by_masjid on placements
  for select using (
    exists (
      select 1 from businesses b
       where b.profile_id = placements.business_id and b.verified_by = (select auth.uid())
    )
  );

create policy applications_select_for_masjid_routed on applications
  for select using (
    exists (
      select 1 from placements p
       join businesses b on b.profile_id = p.business_id
      where p.id = applications.placement_id and b.verified_by = (select auth.uid())
    )
  );

-- Every apprenticeship currently routed through businesses this masjid verified
-- (businesses.verified_by, 0008), nearest thing to a "row per apprenticeship" projection.
create or replace view masjid_routed_apprenticeships
with (security_invoker = true) as
  select
    b.verified_by as masjid_id,
    p.id as placement_id,
    p.business_id,
    p.trade_category,
    p.status as placement_status,
    a.id as application_id,
    a.apprentice_id,
    a.status as application_status
  from placements p
  join businesses b on b.profile_id = p.business_id
  left join applications a on a.placement_id = p.id
  where b.verified_by is not null;
