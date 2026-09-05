-- T011: immutable audit trail (FR-023, constitution Principle V).
-- Rows are written in the same transaction as the state change they record — never as a
-- best-effort follow-up call. There is no update or delete policy: append-only by construction.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  subject_type text not null,
  subject_id uuid not null,
  action text not null,
  occurred_at timestamptz not null default now()
);

alter table audit_log enable row level security;

-- Subjects can read audit rows about themselves; nobody can write through the client.
-- All writes go through security-definer functions below.
create policy audit_log_select_own on audit_log
  for select using ((select auth.uid()) in (actor_id, subject_id));

create or replace function write_audit(
  p_actor uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_action text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_log (actor_id, subject_type, subject_id, action)
  values (p_actor, p_subject_type, p_subject_id, p_action);
$$;

-- Block UPDATE/DELETE even for privileged roles: the record is immutable once written.
create or replace function reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only (FR-023)' using errcode = 'check_violation';
end;
$$;

create trigger audit_log_no_update
  before update or delete on audit_log
  for each row execute function reject_audit_mutation();

create index audit_log_subject_idx on audit_log (subject_type, subject_id, occurred_at desc);

-- In-app half of FR-024 (the email half is sent from lib/notifications). Lives in this
-- migration because the notification service (T013) is foundational and shares its lifecycle.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  subject text not null,
  body text not null,
  event_kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select using ((select auth.uid()) = recipient_id);

create policy notifications_update_own on notifications
  for update using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);
