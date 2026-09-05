# Phase 1 Data Model: Apprenticeship Matching & Placement MVP

All tables carry `created_at`/`updated_at`. All tables have Row-Level Security enabled with a
default-deny policy; grants are additive per role, per constitution Principle V.

## profiles

One row per authenticated user, regardless of account type.

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | = Supabase auth user id |
| account_type | enum(`apprentice`, `business`, `organization`) | Set at signup, immutable |
| display_name | text | |
| coarse_location | geography(Point, 4326) | Postal code / city centroid only — never a street address (Principle VI) |
| date_of_birth | date, nullable | Populated for `apprentice` only; used solely for eligibility (FR-010) |
| guardian_contact | jsonb, nullable | Populated only when `date_of_birth` implies a minor |

**Validation**: `date_of_birth` required and `guardian_contact` required if `account_type = apprentice`
and computed age < 18 as of today. `coarse_location` required for `apprentice` and `business`.

**RLS grants** (additive on top of default-deny, per constitution Principle V): every
authenticated user gets SELECT/UPDATE on their own row (`auth.uid() = id`). Beyond that,
`display_name`, `trade_categories`-bearing fields, and `verification_status` for `business`
accounts are readable by any authenticated user (needed for search results and endorsement
display); `date_of_birth` and `guardian_contact` are never selectable by anyone but the row
owner and server-side query paths that evaluate eligibility — they are never returned to a
client. No policy grants blanket cross-account read access.

## businesses

Extends a `profiles` row with `account_type = business`.

| Field | Type | Notes |
| --- | --- | --- |
| profile_id | uuid, PK, FK → profiles.id | |
| trade_categories | text[] | Closed list, validated in `lib/domain/validation` |
| verification_status | enum(`unverified`, `verified`, `revoked`) | Server-authoritative (FR-002); never set from client input |
| verified_by | uuid, nullable, FK → profiles.id | Set with `verification_status` transition |
| verified_at | timestamptz, nullable | |

**State transitions**: `unverified → verified` and `verified → revoked`, both only via an
admin/ops action that also writes an `audit_log` row (FR-003). A `revoked` business's placements
are withdrawn from search in the same transaction (edge case in spec).

## organizations

Extends a `profiles` row with `account_type = organization`. No additional fields beyond
`profiles` for the MVP — a vouching organization's identity (name, location) is enough to render
an endorsement as a named reference (FR-005).

## endorsements

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| organization_id | uuid, FK → organizations.profile_id | |
| subject_type | enum(`apprentice`, `business`) | |
| apprentice_subject_id | uuid, nullable, FK → profiles.id | Set only when `subject_type = 'apprentice'` |
| business_subject_id | uuid, nullable, FK → businesses.profile_id | Set only when `subject_type = 'business'` |
| decision | enum(`endorsed`) | Single-valued for MVP; no free-text assessment field exists (FR-005, constitution Principle VI) |

**Constraints**: `subject_id` is polymorphic (an apprentice profile or a business), which a
single Postgres FK cannot express. Instead of one untyped `uuid` column, the table carries two
nullable, individually-FK'd columns plus a CHECK constraint enforcing that exactly one is set and
it matches `subject_type`:
`(subject_type = 'apprentice' AND apprentice_subject_id IS NOT NULL AND business_subject_id IS NULL)
OR (subject_type = 'business' AND business_subject_id IS NOT NULL AND apprentice_subject_id IS NULL)`.
This keeps referential integrity a native constraint rather than an application-level check.

**Validation**: Insert policy rejects a row where `business_subject_id` resolves to a business
owned by (or identical to) `organization_id` — self-endorsement (FR-004, edge case).

## placements

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| business_id | uuid, FK → businesses.profile_id | |
| trade_category | text | |
| description | text | |
| coarse_location | geography(Point, 4326) | |
| region | text | Used for wage-floor lookup |
| duration_weeks | int | |
| weekly_hours | int | |
| hourly_rate | numeric(6,2) | CHECK `hourly_rate >= (SELECT hourly_minimum FROM wage_floors WHERE region = placements.region)` |
| capacity | int | CHECK `capacity > 0` |
| start_window_start | date | |
| start_window_end | date | |
| required_certifications | text[] | |
| age_restriction_category | enum(`none`, `heavy_equipment`, `high_voltage`, `confined_space`, `other_hazardous`) | Decided in research.md §3; drives FR-010 |
| status | enum(`draft`, `open`, `withdrawn`, `filled`) | `draft` until business is verified and rate clears the wage floor |

**Validation**: Insert/publish rejected (stays `draft`) unless the owning business's
`verification_status = verified` (FR-002) and `hourly_rate` clears the region's wage floor
(FR-007). Search (FR-008–FR-011) only ever selects `status = open` rows from businesses with
`verification_status = verified`, with `age_restriction_category != 'none'` excluded for
searchers who will be under 18 at `start_window_start`.

## wage_floors

Reference data seeded per Decision 1 in research.md, not user-editable in the MVP.

| Field | Type | Notes |
| --- | --- | --- |
| region | text, PK | |
| hourly_minimum | numeric(6,2) | |
| effective_date | date | |

## applications

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| placement_id | uuid, FK → placements.id | |
| apprentice_id | uuid, FK → profiles.id | |
| availability | text | |
| experience | text | |
| statement | text | |
| status | enum(`submitted`, `under_review`, `accepted`, `declined`, `withdrawn`) | |
| decided_by | uuid, nullable, FK → profiles.id | |
| decided_at | timestamptz, nullable | |
| withdrawal_reason_category | enum(`apprentice_withdrew`, `business_terminated`, `mutual`, `other`), nullable | Distinguishes an apprentice-initiated withdrawal from a business-initiated termination (FR-018) without a parallel status value |
| withdrawn_by | uuid, nullable, FK → profiles.id | |
| withdrawn_at | timestamptz, nullable | |

**Constraints**:
- Unique index on `(placement_id, apprentice_id)` — makes duplicate applications (FR-013)
  structurally impossible rather than conditionally checked.
- Acceptance transaction does `SELECT ... FOR UPDATE` on the target `placements` row and counts
  existing `accepted` applications before writing a new `accepted` status, so capacity (FR-017)
  is enforced under concurrent acceptance attempts, not just checked-then-written.
- Acceptance is blocked at the database layer (RLS/trigger) if the applicant is a minor and no
  matching `guardian_consents` row exists (FR-014, acceptance scenario 4).
- **Pre-acceptance select policy** exposes apprentice/business contact columns as `NULL` via a
  view unless `status = accepted`; contact columns become selectable only after acceptance
  (FR-015).

**State transitions**: `submitted → under_review → accepted | declined`; `submitted | under_review → withdrawn`
by the apprentice; `accepted → withdrawn` before or during the placement, initiated by either
party and distinguished by `withdrawal_reason_category` (edge case). Withdrawing an `accepted`
application releases the placement's committed capacity in the same transaction.

## guardian_consents

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| application_id | uuid, FK → applications.id | |
| document_path | text | Supabase Storage object path (Decision 2, research.md) |
| recorded_at | timestamptz | |
| recorded_by | uuid, FK → profiles.id | The guardian's authenticated action, or staff recording on their behalf |

## agreements

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| application_id | uuid, FK → applications.id, unique | One agreement per accepted application |
| duration_weeks | int | Copied from placement at generation time |
| weekly_hours | int | |
| hourly_rate | numeric(6,2) | |
| mentorship_milestones | jsonb | |
| safety_obligations | text | |
| termination_terms | text | |
| generated_at | timestamptz | |

**Validation**: Row is generated exactly once, in the same transaction as the application's
`accepted` transition (FR-016). No update path exists — immutable once issued, matching the Key
Entities description in spec.md.

## competency_entries

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| placement_id | uuid, FK → placements.id | |
| application_id | uuid, FK → applications.id | |
| mentor_id | uuid, FK → businesses.profile_id | |
| competency | text | |
| signed_at | timestamptz | |

**Validation**: Insert policy requires `application_id` to be `accepted` with `withdrawn_at IS
NULL`, the placement's start date to have passed, and the acting user to be the placement's
mentor (FR-019, FR-022). No update or delete policy exists for the apprentice — immutable to
them (FR-020).

## audit_log

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, PK | |
| actor_id | uuid, FK → profiles.id | |
| subject_type | text | e.g. `business`, `application`, `agreement`, `competency_entry` |
| subject_id | uuid | |
| action | text | e.g. `verified`, `revoked`, `accepted`, `declined`, `withdrawn`, `agreement_generated`, `competency_signed` |
| occurred_at | timestamptz | |

**Validation**: Written in the same transaction as the state change it records (verification
decisions, application status transitions, agreement generation, competency sign-offs — FR-023),
via a trigger or the same Server Action transaction, never as a best-effort follow-up call.
