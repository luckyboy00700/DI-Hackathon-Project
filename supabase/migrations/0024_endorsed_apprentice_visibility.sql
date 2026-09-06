-- An organization needs to see the display_name of an apprentice it has vouched for, or its own
-- "vouches given" list can only ever show a placeholder. Scoped narrowly to an existing
-- endorsement relationship — the same relationship-gated pattern as
-- profiles_select_own_applicants (0017) — rather than a blanket grant to browse apprentices.

create policy profiles_select_endorsed_by_org on profiles
  for select using (
    exists (
      select 1 from endorsements e
       where e.apprentice_subject_id = profiles.id
         and e.organization_id = (select auth.uid())
    )
  );
