# Phase 1 Contracts: Server Actions

Each action is a Next.js Server Action. Every input is parsed through the named Zod schema at
the boundary (constitution Principle I); nothing reaches `lib/db/**` unparsed. Each action below
gets a failing contract test before implementation (constitution Principle II).

## searchPlacements

**Input** (`SearchPlacementsInput`):
```
{ apprenticeId: string; distanceKm: number; tradeCategory?: string;
  minWeeks?: number; maxWeeks?: number; minWeeklyHours?: number; maxWeeklyHours?: number;
  startAfter?: string /* ISO date */; startBefore?: string /* ISO date */; page: number }
```

**Output** (`SearchPlacementsResult`):
```
{ results: Array<{ placementId: string; tradeCategory: string; distanceKm: number;
    businessName: string; hourlyRate: number; startWindow: [string, string] }>;
  totalCount: number; page: number }
```

**Behavior**: Selects only `status = open` placements from `verification_status = verified`
businesses, excludes any placement whose `age_restriction_category != 'none'` when the
apprentice will be under 18 at `start_window_start` (FR-010, FR-011), orders by `distanceKm`
ascending, paginates server-side at 20/page (Principle IV). Empty result set is a valid
response, not an error — the UI renders the widen-radius / saved-alert empty state (edge case).

**Errors**: `INVALID_INPUT` (schema failure) — no other error path; an empty match is success
with zero results.

## createPlacement

**Input** (`CreatePlacementInput`): trade category, description, coarse location, region,
duration, weekly hours, hourly rate, capacity, start window, required certifications,
`age_restriction_category`.

**Output**: `{ placementId: string; status: 'draft' | 'open' }`.

**Behavior**: Rejects (stays `draft`, action still succeeds structurally) unless the calling
business's `verification_status = verified` (FR-002) and `hourly_rate` clears `wage_floors` for
`region` (FR-007); on success the response states which condition, if any, kept it in `draft`.

**Errors**: `INVALID_INPUT`, `BUSINESS_NOT_VERIFIED`, `RATE_BELOW_WAGE_FLOOR` (includes the
applicable floor value).

## submitApplication

**Input** (`SubmitApplicationInput`): `{ placementId: string; availability: string;
experience: string; statement: string }`.

**Output**: `{ applicationId: string; status: 'submitted' }`.

**Errors**: `INVALID_INPUT`, `DUPLICATE_APPLICATION` (FR-013, backed by the unique index —
this error surfaces a constraint violation, it does not pre-check-then-race), `PLACEMENT_NOT_OPEN`.

## recordGuardianConsent

**Input** (`RecordGuardianConsentInput`): `{ applicationId: string; documentPath: string }`
(document already uploaded to Supabase Storage by a prior, separate upload step).

**Output**: `{ consentId: string; recordedAt: string }`.

**Errors**: `INVALID_INPUT`, `APPLICATION_NOT_FOUND`, `NOT_A_MINOR_APPLICATION` (consent is only
meaningful, and only accepted, for applications from applicants under 18 at the placement start
date).

## decideApplication

**Input** (`DecideApplicationInput`): `{ applicationId: string; decision: 'accepted' | 'declined' }`.

**Output**: `{ applicationId: string; status: string; agreementId?: string }` — `agreementId` is
present only when `decision = 'accepted'`.

**Behavior**: On `accepted`, runs inside one transaction: `SELECT ... FOR UPDATE` the placement
row, verify capacity not exceeded (FR-017), verify guardian consent recorded if the applicant is
a minor (FR-014), generate the `agreements` row (FR-016), write the `audit_log` row (FR-023).
Contact fields become visible to both parties only after this transaction commits (FR-015). On
`declined`, writes the status transition and its own `audit_log` row in one transaction — FR-023
requires an audit record for every application status transition, not only acceptance.

**Errors**: `INVALID_INPUT`, `GUARDIAN_CONSENT_REQUIRED`, `CAPACITY_EXCEEDED`,
`APPLICATION_ALREADY_DECIDED`.

## withdrawApplication

**Input** (`WithdrawApplicationInput`): `{ applicationId: string;
reasonCategory: 'apprentice_withdrew' | 'business_terminated' | 'mutual' | 'other'; note?: string }`.

**Output**: `{ applicationId: string; status: 'withdrawn'; capacityReleased: boolean }`.

**Behavior**: Callable by the apprentice on their own application or by the business that owns
the placement, before or during the placement (FR-018). If the application was `accepted`, the
transaction sets `withdrawn_at`/`withdrawn_by`/`withdrawal_reason_category`, releases the
placement's committed capacity, and writes the `audit_log` row in the same transaction — the
same pattern `decideApplication` uses for acceptance. `reasonCategory` distinguishes an
apprentice-initiated withdrawal from a business-initiated termination without a separate status
value.

**Errors**: `INVALID_INPUT`, `APPLICATION_NOT_FOUND`, `ALREADY_TERMINAL` (application is already
`declined` or `withdrawn`), `NOT_AUTHORIZED` (caller is neither the applicant nor the owning
business).

## signCompetency

**Input** (`SignCompetencyInput`): `{ applicationId: string; competency: string }`.

**Output**: `{ competencyEntryId: string; signedAt: string }`.

**Errors**: `INVALID_INPUT`, `PLACEMENT_NOT_ACTIVE` (FR-022 — placement has not started, or has
ended/been terminated), `NOT_PLACEMENT_MENTOR`.

## endorse

**Input** (`EndorseInput`): `{ subjectType: 'apprentice' | 'business'; subjectId: string }`.

**Output**: `{ endorsementId: string }`.

**Errors**: `INVALID_INPUT`, `SELF_ENDORSEMENT_REJECTED` (FR-004 — subject resolves to the
endorsing organization itself or a business it owns).
