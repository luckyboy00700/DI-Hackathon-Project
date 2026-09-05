-- T008: businesses. verification_status is server-authoritative (FR-002) and is never writable
-- by the account itself — no update policy grants it, so the client cannot self-verify.

create type verification_status as enum ('unverified', 'verified', 'revoked');

create type trade_category as enum (
  'electrical', 'plumbing', 'carpentry', 'hvac', 'welding', 'masonry',
  'automotive', 'landscaping', 'print_design', 'photography', 'videography', 'upholstery'
);

create table businesses (
  profile_id uuid primary key references profiles (id) on delete cascade,
  trade_categories trade_category[] not null default '{}',
  verification_status verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table businesses enable row level security;

create policy businesses_select_authenticated on businesses
  for select using ((select auth.uid()) is not null);

create policy businesses_insert_own on businesses
  for insert with check ((select auth.uid()) = profile_id);

-- Owners may edit their trade categories but NOT their verification status: the column-level
-- guard below rejects any self-service change to verification_status.
create policy businesses_update_own_non_verification on businesses
  for update using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create or replace function guard_business_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and current_setting('app.verification_actor', true) is null then
    raise exception 'verification_status is server-authoritative (FR-002)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger businesses_guard_verification
  before update on businesses
  for each row execute function guard_business_verification_status();

create index businesses_verification_idx on businesses (verification_status);
create index businesses_trade_categories_idx on businesses using gin (trade_categories);
