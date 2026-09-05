# Phase 0 Research: Apprenticeship Matching & Placement MVP

## 1. Jurisdictional wage floor (FR-007)

**Decision**: Per-region lookup table (`wage_floors(region, hourly_minimum, effective_date)`),
joined at placement-create/edit time against the placement's declared region.

**Rationale**: Resolved with the user during `/speckit-specify` — the pilot is expected to span
multiple regions with different statutory minimums, so a single constant would either be wrong
for some regions or require a redeploy to update. A lookup table keeps the floor data-editable
without a code change, and the CHECK constraint (`placements.hourly_rate >= wage_floors.hourly_minimum`)
still lives at the data layer per Principle I/V.

**Alternatives considered**:
- *Single global constant*: simplest, but wrong the moment the pilot has a second region.
- *External wage-floor API*: most correct long-term, but an unnecessary integration for a
  48-hour build with a handful of seeded regions.

## 2. Guardian consent artifact (FR-014)

**Decision**: Uploaded, signed consent document stored in Supabase Storage, referenced by
`guardian_consents.document_path`, with an audit record on upload.

**Rationale**: Resolved with the user during `/speckit-specify`. A typed attestation is faster
to build but the user explicitly chose the stronger evidentiary form given the constitution's
framing of minor-protection failures as project-ending. Supabase Storage is already in the
stack (same project as Auth/Postgres), so this adds no new vendor.

**Alternatives considered**:
- *Typed/checkbox attestation*: fastest, rejected by the user as insufficient evidence for a
  legal consent record.
- *Third-party e-signature service*: strongest legal standing, rejected as unbuildable
  integration work within 48 hours.

## 3. Hazardous-occupation classification (age-restriction flag)

**Decision**: `placements.age_restriction_category` is a closed Postgres enum:
`none | heavy_equipment | high_voltage | confined_space | other_hazardous`. Any value other than
`none` sets the placement as age-restricted for the FR-010 predicate.

**Rationale**: The constitution (Principle V) names heavy equipment, high-voltage, confined
space, and "any hazardous occupation classification" as the restricted set. A closed enum keeps
the age-gating predicate decidable in SQL — `age_restriction_category != 'none'` — instead of
parsing free text, which is what makes server-side enforcement (FR-010) actually reliable
instead of best-effort.

**Alternatives considered**:
- *Free-text hazard description with a boolean flag*: simpler to author, but the boolean is the
  only thing enforceable in SQL and free text can't be trusted to stay in sync with it.
- *Multi-select tag set*: more expressive, but no MVP requirement needs more than "restricted or
  not" plus a human-readable reason, so it's unbuilt flexibility.

## 4. Geo query shape

**Decision**: `ST_DWithin` on a `geography(Point, 4326)` column with a GIST index, computing
distance server-side for display.

**Rationale**: Correct geodesic distance (not flat-Earth approximation) and index-backed —
directly required by constitution Principle IV ("every query filtered by geography ... MUST be
backed by an index. Sequential scans on the placements table are a blocking defect."). Bounding
box prefilters exist as a PostGIS internal optimization already; hand-rolling one in application
code would duplicate what the index does for free.

**Alternatives considered**:
- *Haversine formula in application code*: cannot use a spatial index; degrades to a sequential
  scan past a few thousand rows, breaking the 100ms query budget.
- *Third-party geo search service*: unnecessary infrastructure for pilot scale (hundreds of
  placements).

## 5. Notification channel (FR-024)

**Decision**: In-app notifications plus transactional email, both fired from the same
server-side event on application status change, agreement generation, and business
de-verification.

**Rationale**: Resolved with the user during `/speckit-specify`. Guardians in particular may not
have the apprentice's in-app session open, so email is treated as required reach, not a nice-to-have.

**Alternatives considered**:
- *In-app only*: simplest, rejected by the user because guardians need reach outside the app.
- *In-app + email + SMS*: most reach, rejected as unnecessary integration cost for the pilot.

## 6. Testing a real Postgres without mocking (Principle II)

**Decision**: Supabase CLI local stack (`supabase start`) for integration tests, run against a
throwaway local Postgres with migrations applied fresh per test run; Testcontainers as a fallback
if CI runners can't run the Supabase CLI directly.

**Rationale**: Principle II explicitly forbids mocking the database for data-access tests
because mocked persistence hides exactly the constraint and RLS failures this feature depends
on. The Supabase CLI already ships the local Postgres + PostGIS + Auth emulation needed, so no
separate container orchestration has to be hand-built for a 48-hour window.

**Alternatives considered**:
- *Mocked query layer*: explicitly prohibited by the constitution for this class of test.
- *Shared dev database*: flaky (state bleeds between test runs) and risks running destructive
  test data against something other than a throwaway instance.
