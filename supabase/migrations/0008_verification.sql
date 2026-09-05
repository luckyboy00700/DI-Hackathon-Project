-- T022: verification decisions (FR-003) and the revocation cascade (spec edge case).

alter table businesses
  add column verified_by uuid references profiles (id) on delete set null,
  add column verified_at timestamptz;

/**
 * The single server-authoritative entry point for a verification decision. Sets the guard flag
 * that 0002's trigger requires, records who decided and when, writes the audit row in the SAME
 * transaction (FR-023), and — on revoke — withdraws live placements from search so an
 * unverified business cannot keep an open listing (spec edge case).
 */
create or replace function record_verification_decision(
  p_business uuid,
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

  perform set_config('app.verification_actor', p_actor::text, true);

  update businesses
     set verification_status = p_decision,
         verified_by = p_actor,
         verified_at = now(),
         updated_at = now()
   where profile_id = p_business;

  if not found then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if p_decision = 'revoked' then
    update placements
       set status = 'withdrawn', updated_at = now()
     where business_id = p_business and status = 'open';
  end if;

  perform write_audit(
    p_actor,
    'business',
    p_business,
    case when p_decision = 'verified' then 'verified' else 'revoked' end
  );

  perform set_config('app.verification_actor', '', true);
end;
$$;
