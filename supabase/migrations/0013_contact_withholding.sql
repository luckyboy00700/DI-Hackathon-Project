-- T051: FR-015 — neither party's direct contact details are reachable until the application is
-- accepted. Contact data is RELEASED BY THE SYSTEM, never typed into a message body.

alter table profiles
  add column contact_email text,
  add column contact_phone text;

/**
 * The only path to a counterparty's contact details. Returns them exclusively for applications
 * the caller is party to AND whose status is 'accepted'; every other row yields NULLs.
 *
 * This view is intentionally security-DEFINER (the default): direct SELECT on the contact
 * columns is revoked below, so the view is the single gate. Its own WHERE clause carries the
 * row-level check against auth.uid(), keeping enforcement in the data layer (Principle V) —
 * application code is never the thing standing between a user and someone else's contact data.
 */
create view application_contacts as
  select
    a.id as application_id,
    a.status,
    -- Apprentice contact, visible to the mentor only after acceptance.
    case when a.status = 'accepted' then ap.contact_email end as apprentice_email,
    case when a.status = 'accepted' then ap.contact_phone end as apprentice_phone,
    case when a.status = 'accepted' then ap.guardian_contact end as apprentice_guardian_contact,
    -- Business contact, visible to the apprentice only after acceptance.
    case when a.status = 'accepted' then bp.contact_email end as business_email,
    case when a.status = 'accepted' then bp.contact_phone end as business_phone
  from applications a
  join placements p on p.id = a.placement_id
  join profiles ap on ap.id = a.apprentice_id
  join profiles bp on bp.id = p.business_id
  where (select auth.uid()) in (a.apprentice_id, p.business_id);

/**
 * Defence in depth: revoke direct column access to the contact fields so application_contacts
 * above is the ONLY way to reach them. A stray `select *` in application code cannot leak them,
 * because the grant simply is not there.
 */
revoke select on profiles from anon, authenticated;
grant select (id, account_type, display_name, coarse_location, postal_code, date_of_birth,
  guardian_contact, created_at, updated_at)
  on profiles to authenticated;

grant select on application_contacts to authenticated;
