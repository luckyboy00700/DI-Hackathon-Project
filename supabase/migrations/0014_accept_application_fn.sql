-- T052: the acceptance transaction. Everything FR-014, FR-016, FR-017 and FR-023 require
-- happens here, in ONE transaction, under a row lock.

create or replace function accept_application(
  p_application uuid,
  p_actor uuid,
  p_agreement jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement uuid;
  v_capacity int;
  v_accepted int;
  v_status application_status;
  v_agreement_id uuid;
begin
  -- Lock the placement row FIRST: two mentors clicking accept at the same moment serialize here
  -- instead of both reading a stale count (FR-017).
  select a.placement_id, a.status into v_placement, v_status
    from applications a where a.id = p_application;

  if v_placement is null then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select p.capacity into v_capacity
    from placements p where p.id = v_placement
    for update;

  if not exists (
    select 1 from placements p
     where p.id = v_placement and p.business_id = p_actor
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  if v_status <> 'submitted' and v_status <> 'under_review' then
    raise exception 'APPLICATION_ALREADY_DECIDED' using errcode = 'check_violation';
  end if;

  -- FR-014: a minor cannot be accepted without a recorded guardian consent artifact.
  if application_needs_guardian_consent(p_application)
     and not exists (select 1 from guardian_consents gc where gc.application_id = p_application)
  then
    raise exception 'GUARDIAN_CONSENT_REQUIRED' using errcode = 'check_violation';
  end if;

  select count(*) into v_accepted
    from applications a
   where a.placement_id = v_placement and a.status = 'accepted';

  if v_accepted >= v_capacity then
    raise exception 'CAPACITY_EXCEEDED' using errcode = 'check_violation';
  end if;

  update applications
     set status = 'accepted', decided_by = p_actor, decided_at = now(), updated_at = now()
   where id = p_application;

  insert into agreements (application_id, duration_weeks, weekly_hours, hourly_rate,
    total_estimated_hours, estimated_gross_pay, mentorship_milestones, safety_obligations,
    termination_terms)
  values (
    p_application,
    (p_agreement ->> 'durationWeeks')::int,
    (p_agreement ->> 'weeklyHours')::int,
    (p_agreement ->> 'hourlyRate')::numeric,
    (p_agreement ->> 'totalEstimatedHours')::int,
    (p_agreement ->> 'estimatedGrossPay')::numeric,
    p_agreement -> 'mentorshipMilestones',
    p_agreement -> 'safetyObligations',
    p_agreement ->> 'terminationTerms'
  )
  returning id into v_agreement_id;

  -- Fill the placement once every seat is taken.
  if v_accepted + 1 >= v_capacity then
    update placements set status = 'filled', updated_at = now() where id = v_placement;
  end if;

  perform write_audit(p_actor, 'application', p_application, 'accepted');
  perform write_audit(p_actor, 'agreement', v_agreement_id, 'agreement_generated');

  return v_agreement_id;
end;
$$;

/** Declines: no capacity or agreement side effects, but still an audited transition (FR-023). */
create or replace function decline_application(p_application uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status application_status;
begin
  select a.status into v_status
    from applications a
    join placements p on p.id = a.placement_id
   where a.id = p_application and p.business_id = p_actor;

  if v_status is null then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status not in ('submitted', 'under_review') then
    raise exception 'APPLICATION_ALREADY_DECIDED' using errcode = 'check_violation';
  end if;

  update applications
     set status = 'declined', decided_by = p_actor, decided_at = now(), updated_at = now()
   where id = p_application;

  perform write_audit(p_actor, 'application', p_application, 'declined');
end;
$$;
