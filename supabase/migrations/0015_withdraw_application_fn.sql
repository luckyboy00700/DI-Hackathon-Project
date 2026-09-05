-- T053: withdrawal / termination (FR-018). Either party, before or during the placement.
-- Withdrawing an accepted application RELEASES the seat it was holding.

create or replace function withdraw_application(
  p_application uuid,
  p_actor uuid,
  p_reason withdrawal_reason_category
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement uuid;
  v_status application_status;
  v_apprentice uuid;
  v_business uuid;
  v_released boolean := false;
begin
  select a.placement_id, a.status, a.apprentice_id, p.business_id
    into v_placement, v_status, v_apprentice, v_business
    from applications a
    join placements p on p.id = a.placement_id
   where a.id = p_application;

  if v_placement is null then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Either party may end it; nobody else may.
  if p_actor not in (v_apprentice, v_business) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  if v_status in ('withdrawn', 'declined') then
    raise exception 'ALREADY_TERMINAL' using errcode = 'check_violation';
  end if;

  -- Lock the placement so the seat release and any concurrent acceptance serialize.
  perform 1 from placements where id = v_placement for update;

  if v_status = 'accepted' then
    v_released := true;
  end if;

  update applications
     set status = 'withdrawn',
         withdrawal_reason_category = p_reason,
         withdrawn_by = p_actor,
         withdrawn_at = now(),
         updated_at = now()
   where id = p_application;

  -- A filled placement reopens when a seat frees up and it is still within its start window.
  if v_released then
    update placements
       set status = 'open', updated_at = now()
     where id = v_placement
       and status = 'filled';
  end if;

  perform write_audit(p_actor, 'application', p_application, 'withdrawn');

  return v_released;
end;
$$;
