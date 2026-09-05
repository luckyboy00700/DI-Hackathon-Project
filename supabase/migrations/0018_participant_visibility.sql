/**
 * Two visibility gaps that only appear after a placement is filled.
 *
 * 1. placements_select_open_verified (0007) shows a placement while its status is 'open'. The
 *    moment the last seat is taken the status becomes 'filled', and the accepted apprentice
 *    could no longer read the very placement they are working on. That silently emptied their
 *    Skill Passport, because the competency_entries policy resolves through placements.
 *
 * 2. passport_share_token (0016) was added after 0013 narrowed the column grants on profiles,
 *    so it was never granted and always read back as NULL — the share link never rendered.
 */

create policy placements_select_own_application on placements
  for select using (
    exists (
      select 1 from applications a
       where a.placement_id = placements.id
         and a.apprentice_id = (select auth.uid())
    )
  );

grant select (passport_share_token) on profiles to authenticated;
