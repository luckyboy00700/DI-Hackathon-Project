-- Lets a masjid/community hub (organization) verify its own identity: submit a certification
-- document, and have an already-verified organization review it. This mirrors how businesses are
-- verified (0002/0008), except the reviewer is a peer organization rather than a central admin —
-- there is no admin role in this app, and the whole point of this board is community vouching.

alter table organizations
  add column verification_status verification_status not null default 'unverified',
  add column verified_by uuid references profiles (id) on delete set null,
  add column verified_at timestamptz;

-- No update-own policy exists on organizations (unlike businesses, which need one for
-- trade_categories), so there is already no client path that can write these columns. The only
-- writer is the security-definer function below.
create index organizations_verification_idx on organizations (verification_status);

-- T-shirt version of guardian_consents (0011): an uploaded document kept as a history, reviewed
-- by someone else before anything is decided. Unlike guardian consents, this is not sensitive
-- personal data — it is the organization's own public claim to be who it says it is — so read
-- access is open to any signed-in member, the same openness endorsements already have (0020).
create table organization_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (profile_id) on delete cascade,
  document_path text not null,
  note text check (note is null or length(note) <= 500),
  submitted_at timestamptz not null default now()
);

alter table organization_certifications enable row level security;

create policy org_certifications_select_authenticated on organization_certifications
  for select using ((select auth.uid()) is not null);

create policy org_certifications_insert_own on organization_certifications
  for insert with check ((select auth.uid()) = organization_id);

insert into storage.buckets (id, name, public)
values ('organization-certifications', 'organization-certifications', false)
on conflict (id) do nothing;

create policy "organization certification upload own" on storage.objects
  for insert with check (
    bucket_id = 'organization-certifications' and (select auth.uid()) is not null
  );

-- Open read (unlike guardian-consents' uploader-only read): a reviewing organization must be able
-- to open the document to decide on it.
create policy "organization certification read authenticated" on storage.objects
  for select using (
    bucket_id = 'organization-certifications' and (select auth.uid()) is not null
  );

/**
 * The single server-authoritative entry point for an organization verification decision, mirrors
 * record_verification_decision (0008). The actor must itself be a verified organization: this is
 * the bootstrap chain that lets the network grow without a central authority. Self-review and
 * unverified-actor review are refused here so no client code path can create either.
 */
create or replace function record_organization_verification_decision(
  p_organization uuid,
  p_actor uuid,
  p_decision verification_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_decision not in ('verified', 'revoked') then
    raise exception 'Unsupported verification decision: %', p_decision
      using errcode = 'check_violation';
  end if;

  if p_actor = p_organization then
    raise exception 'SELF_ORG_VERIFICATION_REJECTED' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from organizations
     where profile_id = p_actor and verification_status = 'verified'
  ) then
    raise exception 'ACTOR_ORG_NOT_VERIFIED' using errcode = 'check_violation';
  end if;

  update organizations
     set verification_status = p_decision,
         verified_by = p_actor,
         verified_at = now()
   where profile_id = p_organization;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  perform write_audit(
    p_actor,
    'organization',
    p_organization,
    case when p_decision = 'verified' then 'verified' else 'revoked' end
  );
end;
$$;

-- Same signature as 0021's version, so this replaces it in place: a masjid option on the front
-- page should itself be a verified organization, not just one whose businesses happen to be.
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
  join organizations org on org.profile_id = o.id
  cross join viewer v
  where o.account_type = 'organization'
    and org.verification_status = 'verified'
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
