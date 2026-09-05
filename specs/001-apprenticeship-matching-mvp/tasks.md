---

description: "Task list template for feature implementation"
---

# Tasks: Apprenticeship Matching & Placement MVP

**Input**: Design documents from `/specs/001-apprenticeship-matching-mvp/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/server-actions.md](contracts/server-actions.md),
[quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle II mandates test-first (red-green-refactor) for
eligibility, matching/ranking, agreement generation, endorsement signing, and any age rule; the
plan additionally requires a failing contract test before every Server Action and forbids
mocking the database for data-access tests (real local Supabase Postgres).

**Organization**: Tasks are grouped by user story (from spec.md, in priority order) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are relative to the repository root and match `plan.md`'s Project Structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic tooling

- [X] T001 Create Next.js 15 (App Router) project structure per plan.md: `app/`, `components/`, `lib/`, `supabase/`, `tests/`
- [X] T002 [P] Configure TypeScript 5.x strict mode, ESLint, Prettier (`tsconfig.json`, `.eslintrc.json`, `.prettierrc`) — CI blocks on warnings-as-errors per constitution Principle I
- [X] T003 [P] Install and configure Tailwind CSS v4 + shadcn/ui with design tokens in `components/ui/` and `tailwind.config.ts`
- [X] T004 [P] Configure Vitest for unit tests (`vitest.config.ts`) and Playwright for E2E (`playwright.config.ts`)
- [X] T005 [P] Initialize Supabase project config and local dev stack (`supabase/config.toml`)
- [X] T006 [P] Scaffold shared Zod validation modules in `lib/validation/`

**Checkpoint**: Toolchain runs (`pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `supabase start`) before any schema or feature work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create `profiles` table migration with RLS enabled: default-deny, plus additive self-access (`auth.uid() = id`) and the limited public-read policy for business search/endorsement display fields, per data-model.md's RLS grants note, in `supabase/migrations/0001_profiles.sql`
- [X] T008 Create `businesses` table migration (extends profiles; `verification_status` enum: unverified/verified/revoked) in `supabase/migrations/0002_businesses.sql` (depends on T007)
- [X] T009 [P] Create `organizations` table migration in `supabase/migrations/0003_organizations.sql` (depends on T007)
- [X] T010 [P] Create `wage_floors` reference table + seed rows (research.md decision 1) in `supabase/migrations/0004_wage_floors.sql`
- [X] T011 Create `audit_log` table + reusable trigger/helper for same-transaction audit writes in `supabase/migrations/0005_audit_log.sql`
- [X] T012 Configure Supabase Auth email-OTP flow and session helpers in `lib/auth/`
- [X] T013 [P] Implement notification dispatch service (in-app + email via Resend, research.md decision 5) in `lib/notifications/index.ts`
- [X] T014 [P] Build base shadcn/ui primitives (button, input, card, dialog, form) in `components/ui/` — the only styling surface per constitution Principle III
- [X] T015 [P] Build shared loading/empty/error/success state components in `components/features/states/`
- [X] T016 Seed local Supabase at 10x pilot scale in `supabase/seed.sql` (plan.md Risks: demo data realism)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Business Verification & Placement Publishing (Priority: P1) 🎯 MVP

**Goal**: Businesses register, get verified, and publish placements; unverified businesses are structurally blocked from publishing.

**Independent Test**: Register a business, attempt to publish before verification (refused, draft state, clear reason), record a verification decision, then publish successfully.

### Tests for User Story 1

- [X] T017 [P] [US1] Contract test for `createPlacement` in `tests/contract/test_create_placement.ts`
- [X] T018 [P] [US1] Integration test: unverified business cannot publish (RLS-enforced) in `tests/integration/test_placement_publish_gating.ts`
- [X] T019 [P] [US1] Integration test: placement rejected below its region's wage floor (CHECK constraint) in `tests/integration/test_wage_floor.ts`

### Implementation for User Story 1

- [X] T020 [US1] Create `placements` table migration (status, `age_restriction_category` enum, region, `hourly_rate >= wage_floors.hourly_minimum` CHECK) in `supabase/migrations/0006_placements.sql` (depends on T010)
- [X] T021 [US1] Add RLS policies: publish requires `businesses.verification_status = verified`; only `status = open` visible to non-owners in `supabase/migrations/0007_placements_rls.sql` (depends on T020)
- [X] T022 [US1] Add verification-decision columns/policy (`verified_by`, `verified_at`) and a revoke trigger that withdraws live placements in `supabase/migrations/0008_verification.sql` (depends on T008, T020)
- [X] T023 [US1] Implement `createPlacement` Server Action in `app/(business)/placements/actions.ts` (depends on T017, T020, T021)
- [X] T024 [US1] Implement `recordVerificationDecision` Server Action (writes `audit_log`) in `app/(business)/verification/actions.ts` (depends on T022, T011)
- [X] T025 [P] [US1] Build business placement-creation form UI in `app/(business)/placements/new/page.tsx`
- [X] T026 [P] [US1] Build placement list UI showing draft/open status with plain-language verification-required messaging in `app/(business)/placements/page.tsx`
- [X] T027 [US1] Wire de-verification notification on revoke via `lib/notifications` in `app/(business)/verification/actions.ts` (depends on T013, T022)

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Apprentice Search & Safe Discovery (Priority: P1)

**Goal**: Apprentices search placements by distance/trade/schedule; age-restricted and unverified-business placements never appear, enforced server-side.

**Independent Test**: With placements from User Story 1 published (some verified/unverified, some age-restricted), search as apprentices of different ages and confirm correct filtering and proximity ordering.

### Tests for User Story 2

- [X] T028 [P] [US2] Unit test for age-at-placement-start-date eligibility predicate in `tests/unit/eligibility.test.ts`
- [X] T029 [P] [US2] Unit test for search filter/ranking predicate in `tests/unit/matching.test.ts`
- [X] T030 [P] [US2] Contract test for `searchPlacements` in `tests/contract/test_search_placements.ts`
- [X] T031 [P] [US2] Integration test: age-restricted placements excluded server-side for under-18 searchers in `tests/integration/test_age_gating.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement `lib/domain/eligibility.ts` (age-at-start-date predicate, FR-010) (depends on T028)
- [X] T033 [US2] Implement `lib/domain/matching.ts` (filter + proximity ranking predicate) (depends on T029)
- [X] T034 [US2] Add GIST spatial index on `placements.coarse_location` and composite index on `(status, trade_category)` in `supabase/migrations/0009_search_indexes.sql` (depends on T020)
- [X] T035 [US2] Implement `searchPlacements` Server Action, paginated 20/page, in `app/(public)/search/actions.ts` (depends on T030, T032, T033, T034)
- [X] T036 [P] [US2] Build search/browse UI with distance + trade + schedule filters in `app/(public)/browse/page.tsx`
- [X] T037 [P] [US2] Build empty-state UI offering widened radius / saved alert in `components/features/search/EmptyState.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Application, Guardian Consent & Agreement Generation (Priority: P1)

**Goal**: Apprentices apply; minors require a recorded guardian consent document before acceptance; acceptance atomically enforces capacity, generates an identical agreement for both parties, and releases contact details only at that point. Either party can withdraw or terminate before or during the placement.

**Independent Test**: Submit an application, attempt acceptance without consent (blocked), record consent, accept, and confirm both parties receive the same agreement with no prior contact exposure. Separately, withdraw an accepted application and confirm capacity is released and the reason/timestamp are recorded.

### Tests for User Story 3

- [X] T038 [P] [US3] Unit test for agreement assembly in `tests/unit/agreement.test.ts`
- [X] T039 [P] [US3] Contract test for `submitApplication` in `tests/contract/test_submit_application.ts`
- [X] T040 [P] [US3] Contract test for `recordGuardianConsent` in `tests/contract/test_record_guardian_consent.ts`
- [X] T041 [P] [US3] Contract test for `decideApplication` in `tests/contract/test_decide_application.ts`
- [X] T042 [P] [US3] Contract test for `withdrawApplication` in `tests/contract/test_withdraw_application.ts`
- [X] T043 [P] [US3] Integration test: duplicate application rejected by unique index in `tests/integration/test_duplicate_application.ts`
- [X] T044 [P] [US3] Integration test: capacity enforced atomically under concurrent acceptance (`FOR UPDATE`) in `tests/integration/test_capacity_race.ts`
- [X] T045 [P] [US3] Integration test: acceptance blocked without guardian consent for minors in `tests/integration/test_consent_gate.ts`
- [X] T046 [P] [US3] Integration test: contact fields withheld until status = accepted in `tests/integration/test_contact_withholding.ts`
- [X] T047 [P] [US3] Integration test: withdrawing an accepted application releases placement capacity and records `withdrawal_reason_category` + `withdrawn_at` in `tests/integration/test_withdraw_releases_capacity.ts`

### Implementation for User Story 3

- [X] T048 [US3] Create `applications` table migration with unique `(placement_id, apprentice_id)` index and withdrawal columns (`withdrawal_reason_category`, `withdrawn_by`, `withdrawn_at`) in `supabase/migrations/0010_applications.sql` (depends on T020)
- [X] T049 [US3] Create `guardian_consents` table migration + Supabase Storage bucket policy for consent documents in `supabase/migrations/0011_guardian_consents.sql` (depends on T048)
- [X] T050 [US3] Create `agreements` table migration (immutable, one per application) in `supabase/migrations/0012_agreements.sql` (depends on T048)
- [X] T051 [US3] Add pre-acceptance contact-withholding view/policy on `applications` in `supabase/migrations/0013_contact_withholding.sql` (depends on T048)
- [X] T052 [US3] Add acceptance transaction function (`SELECT ... FOR UPDATE` capacity check + consent check + agreement generation + audit write) in `supabase/migrations/0014_accept_application_fn.sql` (depends on T049, T050, T011)
- [X] T053 [US3] Add withdrawal transaction function (capacity release when withdrawing an `accepted` application + audit write) in `supabase/migrations/0015_withdraw_application_fn.sql` (depends on T048, T011)
- [X] T054 [US3] Implement `lib/domain/agreement.ts` (agreement assembly from placement + application) (depends on T038)
- [X] T055 [US3] Implement `submitApplication` Server Action in `app/(apprentice)/applications/actions.ts` (depends on T039, T048)
- [X] T056 [US3] Implement `recordGuardianConsent` Server Action with document upload in `app/(apprentice)/applications/consent-actions.ts` (depends on T040, T049)
- [X] T057 [US3] Implement `decideApplication` Server Action in `app/(business)/applications/actions.ts`: `decision = 'accepted'` calls the acceptance transaction (T052); `decision = 'declined'` writes the status transition and an `audit_log` row directly, in the same transaction, per FR-023 (depends on T041, T052, T054)
- [X] T058 [US3] Implement `withdrawApplication` Server Action (callable by the apprentice or the owning business) calling the withdrawal transaction in `app/(apprentice)/applications/actions.ts` and `app/(business)/applications/actions.ts` (depends on T042, T053)
- [X] T059 [P] [US3] Build apprentice application form UI in `app/(apprentice)/placements/[id]/apply/page.tsx`
- [X] T060 [P] [US3] Build guardian consent upload UI in `app/(apprentice)/applications/[id]/consent/page.tsx`
- [X] T061 [P] [US3] Build mentor application review/accept/decline UI in `app/(business)/applications/page.tsx`
- [X] T062 [P] [US3] Build server-rendered agreement view/PDF download in `app/(apprentice)/agreements/[id]/page.tsx` and `app/(business)/agreements/[id]/page.tsx`
- [X] T063 [P] [US3] Add withdraw/terminate controls to the apprentice application view and the mentor application view in `components/features/applications/WithdrawButton.tsx`, wired into `app/(apprentice)/applications/page.tsx` and `app/(business)/applications/page.tsx` (depends on T058)
- [X] T064 [US3] Wire status-change, agreement-generated, and withdrawal notifications via `lib/notifications` in `app/(business)/applications/actions.ts` and `app/(apprentice)/applications/actions.ts` (depends on T013, T057, T058)

**Checkpoint**: User Stories 1, 2, and 3 all work independently — this is the demo-critical core.

---

## Phase 6: User Story 4 - Skill Passport Competency Sign-Off (Priority: P2)

**Goal**: Mentors sign off competencies on active placements; entries are immutable to the apprentice and shareable via a read-only, contact-free link.

**Independent Test**: With an accepted, active placement, sign off a competency and confirm it appears on the apprentice's Skill Passport, attributed and timestamped, and cannot be edited or signed off after the placement ends.

### Tests for User Story 4

- [X] T065 [P] [US4] Contract test for `signCompetency` in `tests/contract/test_sign_competency.ts`
- [X] T066 [P] [US4] Integration test: sign-off rejected for inactive/ended/terminated placement (`withdrawn_at IS NOT NULL`) in `tests/integration/test_competency_active_only.ts`
- [X] T067 [P] [US4] Integration test: competency entries immutable to the apprentice (no update/delete policy) in `tests/integration/test_competency_immutable.ts`

### Implementation for User Story 4

- [X] T068 [US4] Create `competency_entries` table migration + RLS policy (active placement, mentor-only insert, no apprentice update) in `supabase/migrations/0016_competency_entries.sql` (depends on T050)
- [X] T069 [US4] Implement `signCompetency` Server Action, writes `audit_log`, in `app/(business)/placements/[id]/sign-off/actions.ts` (depends on T065, T068)
- [X] T070 [P] [US4] Build mentor competency sign-off UI in `app/(business)/placements/[id]/sign-off/page.tsx`
- [X] T071 [P] [US4] Build apprentice Skill Passport view + read-only share link (no contact details) in `app/(apprentice)/passport/page.tsx` and `app/passport/[shareToken]/page.tsx`

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Community Endorsements (Priority: P3)

**Goal**: Vouching organizations endorse apprentices or businesses as named references; self-endorsement is rejected.

**Independent Test**: Register a vouching organization, endorse an existing apprentice and business, confirm correct display to each counterparty, and confirm a self-endorsement attempt is rejected.

### Tests for User Story 5

- [X] T072 [P] [US5] Unit test for self-endorsement rejection logic in `tests/unit/endorsement.test.ts`
- [X] T073 [P] [US5] Contract test for `endorse` in `tests/contract/test_endorse.ts`
- [X] T074 [P] [US5] Integration test: organization cannot endorse itself or a business it owns in `tests/integration/test_self_endorsement.ts`

### Implementation for User Story 5

- [X] T075 [US5] Create `endorsements` table migration with `apprentice_subject_id`/`business_subject_id` columns and the exactly-one-set CHECK constraint, plus RLS self-endorsement rejection policy, in `supabase/migrations/0017_endorsements.sql` (depends on T009)
- [X] T076 [US5] Implement `lib/domain/endorsement.ts` self-endorsement validation (depends on T072)
- [X] T077 [US5] Implement `endorse` Server Action in `app/(org)/endorsements/actions.ts` (depends on T073, T075, T076)
- [X] T078 [P] [US5] Build organization endorse UI in `app/(org)/endorsements/page.tsx`
- [X] T079 [P] [US5] Display endorsements as named organizational references on apprentice/business profile pages in `components/features/profile/EndorsementList.tsx`

**Checkpoint**: All five user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: The two demo-critical E2E flows (constitution Delivery Constraints clause) and final verification across all stories

- [X] T080 [P] E2E test: publish gating (unverified → blocked → verified → published → correctly excluded/included in search) in `tests/e2e/publish-gating.spec.ts`
- [X] T081 [P] E2E test: full apply → consent → accept → sign-off journey in `tests/e2e/apply-accept-signoff.spec.ts`
- [X] T082 [P] Verify every screen at 375px width and WCAG 2.2 AA (contrast, focus states, keyboard operability, labeled controls)
- [X] T083 Run `quickstart.md` validation end-to-end against the local Supabase stack
- [X] T084 [P] Run Lighthouse against the deployed preview and record LCP/INP/CLS/search-p95 against constitution Principle IV budgets
- [X] T085 Reconcile `plan.md` Complexity Tracking entries against what was actually deferred or built

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational + the `placements` table from US1 (T020) — searches placements US1 creates
- **User Story 3 (Phase 5)**: Depends on Foundational + the `placements` table from US1 (T020) — applies to placements US1 creates
- **User Story 4 (Phase 6)**: Depends on Foundational + `applications`/`agreements` from US3 (T048, T050) — signs off against an active placement from an accepted application
- **User Story 5 (Phase 7)**: Depends on Foundational only (`organizations` from T009) — independent of US1–US4 data, though most valuable once apprentices/businesses exist to endorse
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation (constitution Principle II)
- Migrations/RLS before domain logic; domain logic before Server Actions; Server Actions before UI
- Story complete and checkpointed before moving to the next priority

### Parallel Opportunities

- All Setup tasks marked `[P]` (T002–T006) run in parallel
- Foundational tasks marked `[P]` (T009, T010, T013, T014, T015) run in parallel after T007/T008/T011/T012
- Once Foundational completes, US1 and US5 can start in parallel (US5 has no dependency on US1–US4 data)
- All `[P]` tests within a story's test block run in parallel
- All `[P]` UI tasks within a story run in parallel once that story's Server Actions exist

---

## Parallel Example: User Story 3

```bash
# Launch all contract/integration tests for User Story 3 together:
Task: "Contract test for submitApplication in tests/contract/test_submit_application.ts"
Task: "Contract test for recordGuardianConsent in tests/contract/test_record_guardian_consent.ts"
Task: "Contract test for decideApplication in tests/contract/test_decide_application.ts"
Task: "Contract test for withdrawApplication in tests/contract/test_withdraw_application.ts"
Task: "Integration test: duplicate application rejected in tests/integration/test_duplicate_application.ts"
Task: "Integration test: capacity race in tests/integration/test_capacity_race.ts"
Task: "Integration test: consent gate in tests/integration/test_consent_gate.ts"
Task: "Integration test: contact withholding in tests/integration/test_contact_withholding.ts"
Task: "Integration test: withdrawal releases capacity in tests/integration/test_withdraw_releases_capacity.ts"

# Launch all UI tasks for User Story 3 together (once actions exist):
Task: "Build apprentice application form UI in app/(apprentice)/placements/[id]/apply/page.tsx"
Task: "Build guardian consent upload UI in app/(apprentice)/applications/[id]/consent/page.tsx"
Task: "Build mentor application review UI in app/(business)/applications/page.tsx"
Task: "Build agreement view/PDF download in app/(apprentice)/agreements/[id]/page.tsx"
Task: "Add withdraw/terminate controls in components/features/applications/WithdrawButton.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1 (businesses can publish) → **validate independently**
4. Complete Phase 4: User Story 2 (apprentices can safely search) → **validate independently**
5. Complete Phase 5: User Story 3 (apply → consent → accept → agreement → withdraw/terminate) → **validate independently**
6. **STOP here for a demo** — this is the primary journey from spec.md's Yusuf story, minus the Skill Passport payoff and endorsements

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → demo "a business can publish"
3. US2 → test independently → demo "an apprentice can safely find it"
4. US3 → test independently → demo the full trust transaction (**MVP complete**)
5. US4 → test independently → demo the Skill Passport payoff
6. US5 → test independently → demo community endorsement
7. Polish → run both E2E flows, verify budgets, close out Complexity Tracking

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: User Story 1 → then User Story 4 (needs US3's tables first)
- Developer B: User Story 2 (needs only US1's `placements` table)
- Developer C: User Story 5 (fully independent) → then help with User Story 3
- Regroup on User Story 3 (the largest phase) once US1's `placements` table lands

---

## Notes

- `[P]` tasks touch different files with no unmet dependencies
- `[Story]` labels give traceability back to spec.md's prioritized user stories
- Verify each test fails before implementing against it (red-green-refactor, Principle II)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
- Coverage gate for this hackathon build: 100% on `lib/domain/eligibility.ts` and
  `lib/domain/agreement.ts` — the two classes the constitution's Delivery Constraints (Hackathon
  Mode) clause names explicitly (eligibility/age gating and agreement generation).
  `lib/domain/endorsement.ts` (endorsement signing) is held to the same 100% bar as a project
  choice made on top of that clause, not a citation of it; everything else is best-effort.
