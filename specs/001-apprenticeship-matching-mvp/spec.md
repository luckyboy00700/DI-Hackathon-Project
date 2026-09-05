# Feature Specification: Apprenticeship Matching & Placement MVP

**Feature Branch**: `001-apprenticeship-matching-mvp`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Localized platform connecting Muslim trade contractors and creative studios with high-school and college students seeking paid summer apprenticeships."

## Why This Exists

Skilled trades face a retirement wave and a labor shortage while entry-level white-collar hiring
contracts. Students want earning paths that do not require debt and are not displaced by
automation. Meanwhile, small community-run trade businesses have no low-friction way to find,
vet, and formalize junior help — so mentorship capital and training investment leak out of the
neighborhood.

The gap is not a lack of jobs or a lack of candidates. It is a lack of trust infrastructure: a
contractor will not hand a 17-year-old a set of tools on the strength of a resume, and a parent
will not send a teenager to a stranger's job site on the strength of a listing. This feature
builds the trust layer — verified businesses, community endorsement, standardized agreements,
and a portable record of what the apprentice actually did.

## User Scenarios & Testing *(mandatory)*

### Primary Journey (illustrative)

Yusuf, a 17-year-old high-school junior, opens the platform in April. He filters for placements
within 15 miles that start after his exams and involve electrical work. He finds three verified
contractors, reads what past apprentices logged, and applies to one with a short intake form.
His guardian receives and signs a consent record. The mentor reviews the application alongside
an endorsement from Yusuf's local masjid, accepts, and both parties receive a standardized
10-week agreement stating hours, hourly rate, safety requirements, and mentorship milestones.
Over the summer the mentor signs off on competencies Yusuf demonstrates. In August, Yusuf has a
verified Skill Passport — proof of work signed by a real practitioner, not a self-reported CV.

### User Story 1 - Business Verification & Placement Publishing (Priority: P1)

A trade contractor or creative studio registers a business account, completes verification, and
publishes a placement describing the role, schedule, pay, and any age restriction. Nothing else
in the system can function until verified businesses can publish real placements.

**Why this priority**: This is the supply side of the marketplace. Without a verified placement
to find, no apprentice-facing story can be demonstrated or tested.

**Independent Test**: Register a business, attempt to publish before verification (must be
refused with a clear reason), record a verification decision, then publish successfully. Fully
testable without any apprentice involved.

**Acceptance Scenarios**:

1. **Given** an unverified business account, **When** it attempts to publish a placement,
   **Then** publication is refused, the placement remains in a draft state, and the response
   clearly explains what verification requires.
2. **Given** a business account with a recorded verification decision, **When** it publishes a
   placement with trade category, description, coarse location, duration, weekly hours, hourly
   rate, capacity, start window, required certifications, and an age-restriction flag, **Then**
   the placement becomes visible in search once its hourly rate clears the regional wage floor.
3. **Given** a placement whose hourly rate is below the wage floor for its region, **When** the
   business attempts to publish it, **Then** publication is rejected with the applicable floor
   stated.
4. **Given** a verified business with live placements and applications in flight, **When** its
   verification is revoked, **Then** its placements are withdrawn from search and affected
   applicants are notified.

---

### User Story 2 - Apprentice Search & Safe Discovery (Priority: P1)

An apprentice sets up a profile with a coarse location and availability, then searches published
placements by distance, trade category, duration, weekly-hours range, and start window. Results
never include placements from unverified businesses or age-restricted placements the searcher is
not eligible for.

**Why this priority**: This is the demand-side entry point and the first place the safety
guarantees (verification, age gating) must hold or the product's core promise fails immediately.

**Independent Test**: With placements from User Story 1 already published (some verified, some
not; some age-restricted, some not), search as apprentices of different ages and confirm the
result set is correctly filtered and ordered — testable independently of applications.

**Acceptance Scenarios**:

1. **Given** a student profile with a coarse location and stated availability, **When** they
   search with a distance and trade filter, **Then** only open, verified placements matching all
   filters are shown, ordered by proximity, with distance displayed.
2. **Given** an applicant who will be under 18 at a placement's start date, **When** they browse
   or search, **Then** age-restricted placements are excluded from their results, enforced by
   the system rather than by the display layer.
3. **Given** a search that matches no placements, **When** results are returned, **Then** the
   empty state offers a widened radius or a saved-alert path rather than a dead end.

---

### User Story 3 - Application, Guardian Consent & Agreement Generation (Priority: P1)

An apprentice applies to a placement. If the apprentice is a minor, a guardian consent artifact
must be recorded before the mentor can accept. On acceptance, both parties receive an identical
standardized agreement, and contact details are released only at that point.

**Why this priority**: This is the core trust transaction the entire product exists to broker —
the moment a stranger's promise becomes a recorded, mutual commitment.

**Independent Test**: Using a published placement and an apprentice profile, submit an
application, attempt acceptance without consent (must block), record consent, accept, and
confirm both parties receive the same agreement with no prior contact exposure.

**Acceptance Scenarios**:

1. **Given** a submitted application from a minor without recorded guardian consent, **When**
   the mentor attempts to accept it, **Then** acceptance is blocked until consent is recorded.
2. **Given** a mentor accepts an application, **When** the placement agreement is generated,
   **Then** both parties receive an identical agreement containing duration, weekly hours,
   hourly rate, safety obligations, mentorship milestones, and termination terms, and neither
   party's contact details were exposed before acceptance.
3. **Given** a placement with capacity of one, **When** a second application is accepted after
   the first, **Then** the second acceptance fails with a clear message.
4. **Given** an apprentice applies a second time to a placement they already applied to,
   **When** they submit, **Then** the duplicate application is rejected.
5. **Given** an agreement has been generated, **When** the apprentice withdraws before the start
   date, **Then** the withdrawal is recorded with a reason and timestamp and the placement's
   capacity is released.

---

### User Story 4 - Skill Passport Competency Sign-Off (Priority: P2)

During an active placement, the mentor signs off on discrete competencies the apprentice
demonstrated. These entries accumulate into a portable, mentor-attested Skill Passport the
apprentice can share.

**Why this priority**: This is the durable output of a successful placement and the platform's
long-term differentiator, but it only matters once P1 placements exist and are active.

**Independent Test**: With an accepted, active placement from User Story 3, sign off a
competency and confirm it appears on the apprentice's Skill Passport, attributed and
timestamped, and cannot be edited by the apprentice or signed off after the placement ends.

**Acceptance Scenarios**:

1. **Given** an active placement, **When** the mentor signs off on a competency the apprentice
   performed, **Then** the entry appears on the apprentice's Skill Passport attributed to the
   signing mentor with a timestamp, and cannot be edited by the apprentice.
2. **Given** a placement that has ended or been terminated, **When** the mentor attempts to sign
   off a competency against it, **Then** the sign-off is rejected.
3. **Given** an apprentice's Skill Passport, **When** they generate a share link, **Then** the
   link is read-only and reveals no contact details.

---

### User Story 5 - Community Endorsements (Priority: P3)

A registered vouching organization (e.g. a masjid or civic hub) endorses an apprentice or a
business. The endorsement appears to the counterparty as a named organizational reference, never
as free-text character commentary, and an organization cannot endorse itself or an entity it
owns.

**Why this priority**: Endorsements add trust signal on top of an already-functioning
marketplace; the product works without them for a first demo, but they reinforce the credibility
loop described in the primary journey.

**Independent Test**: Register a vouching organization, endorse an existing apprentice and an
existing business, and confirm the endorsement displays correctly to each counterparty; attempt
a self-endorsement and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** a registered vouching organization, **When** it endorses an applicant or a
   business, **Then** the endorsement is visible to the counterparty as a named organizational
   reference, without free-text character commentary.
2. **Given** a vouching organization that also owns a business, **When** it attempts to endorse
   that business, **Then** the self-endorsement is rejected.

---

### Edge Cases

- A business's verification is revoked while placements are live and applications are in
  flight — placements must be withdrawn from search and applicants notified.
- An applicant turns 18 mid-application — eligibility is evaluated against age at the placement
  start date, not the application date.
- Two applicants are accepted for a placement with capacity of one — capacity must be enforced
  atomically; the second acceptance fails with a clear message.
- A mentor attempts to sign off a competency after the placement has ended or been terminated.
- A search returns zero results — the empty state must offer a widened radius or a saved-alert
  path rather than a dead end.
- An apprentice withdraws after an agreement is generated but before the start date.
- A vouching organization endorses a business it also owns — self-endorsement must be rejected.

## Requirements *(mandatory)*

### Functional Requirements

**Identity & Verification**

- **FR-001**: System MUST support three account types: apprentice, business/mentor, and
  vouching organization.
- **FR-002**: System MUST hold business accounts in an unverified state until a verification
  decision is recorded, and MUST prevent unverified businesses from publishing placements or
  accepting applications.
- **FR-003**: System MUST record who made each verification decision and when.
- **FR-004**: System MUST allow a vouching organization to endorse an apprentice or a business,
  and MUST reject self-endorsement.
- **FR-005**: System MUST display endorsements as named organizational references without
  storing free-text character assessments.

**Placements & Discovery**

- **FR-006**: Businesses MUST be able to create a placement specifying trade category,
  description, coarse location, duration in weeks, weekly hours, hourly rate, capacity, start
  window, required certifications, and an age-restriction flag.
- **FR-007**: System MUST reject placements whose hourly rate falls below the minimum wage
  configured for the placement's region. The wage floor is a per-region value, looked up by the
  placement's stated region at creation and re-checked if the placement is edited.
- **FR-008**: Apprentices MUST be able to search placements filtered by distance from their
  coarse location, trade category, duration, weekly-hours range, and start window.
- **FR-009**: Search results MUST display distance and MUST be ordered by proximity by default.
- **FR-010**: System MUST exclude age-restricted placements from results for applicants who
  will be under 18 at the placement start date, enforced server-side.
- **FR-011**: System MUST show only open placements from verified businesses in search results.

**Applications & Agreements**

- **FR-012**: Apprentices MUST be able to submit one application per placement, containing
  availability, relevant experience, and a short statement.
- **FR-013**: System MUST prevent duplicate applications to the same placement.
- **FR-014**: System MUST require a recorded guardian consent artifact — an uploaded, signed
  consent document associated with the minor's application — before an application from a minor
  can be accepted.
- **FR-015**: System MUST withhold both parties' direct contact details until an application
  reaches accepted status.
- **FR-016**: On acceptance, system MUST generate a standardized agreement containing duration,
  weekly hours, hourly rate, mentorship milestones, safety and equipment obligations, and
  termination terms.
- **FR-017**: System MUST enforce placement capacity atomically; acceptances beyond capacity
  MUST fail.
- **FR-018**: System MUST allow either party to withdraw or terminate before or during a
  placement, recording the reason category and timestamp.

**Skill Passport**

- **FR-019**: Mentors MUST be able to sign off discrete competencies against an active
  placement.
- **FR-020**: Competency entries MUST be immutable to the apprentice and attributed to the
  signing mentor with a timestamp.
- **FR-021**: Apprentices MUST be able to view their Skill Passport and share it via a read-only
  link that reveals no contact details.
- **FR-022**: Competency sign-off MUST be rejected for placements that are not active.

**Auditability & Notifications**

- **FR-023**: System MUST write an immutable audit record for verification decisions,
  application status transitions, agreement generation, and competency sign-offs.
- **FR-024**: System MUST notify affected parties, in-app and by email, on application status
  change, agreement generation, and business de-verification.

### Key Entities

- **Apprentice** — a student seeking a placement. Holds date of birth (for eligibility only),
  coarse location, availability window, interests, and guardian contact when a minor.
- **Business** — a trade contractor or creative studio. Holds trade categories, coarse
  location, and verification status. (Capacity is per-placement, not per-business — see
  Placement.)
- **Vouching Organization** — a masjid or civic hub acting as a reference node.
- **Endorsement** — a directed relationship from a vouching organization to an apprentice or
  business, with a decision and timestamp.
- **Placement** — a published apprenticeship opportunity with schedule, pay, capacity,
  certification requirements, region (for wage-floor lookup), and an age-restriction flag.
- **Application** — an apprentice's submission to a placement; moves through
  submitted → under review → accepted/declined/withdrawn.
- **Agreement** — the standardized contract generated on acceptance; immutable once issued.
- **Guardian Consent** — a recorded, uploaded signed consent document tied to a minor's
  application.
- **Competency Entry** — a mentor-signed record of a skill demonstrated during an active
  placement; the unit of the Skill Passport.
- **Audit Record** — actor, subject, action, timestamp for every trust-bearing event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time apprentice reaches a relevant, filtered result set in under 60
  seconds from landing, without assistance.
- **SC-002**: A business publishes a complete placement in under 5 minutes.
- **SC-003**: At least 90% of applications reach a terminal status (accepted, declined, or
  withdrawn) rather than being abandoned in review.
- **SC-004**: Zero instances of an under-18 applicant being shown or accepted into an
  age-restricted placement.
- **SC-005**: Zero instances of contact details being exposed before acceptance.
- **SC-006**: 100% of accepted placements have an agreement containing all required terms.
- **SC-007**: Every completed placement produces at least three signed competency entries.
- **SC-008**: Search returns results within 1 second at the 95th percentile on a mid-range
  phone over a cellular connection.

## Out of Scope

- Payment processing, payroll, escrow, or tax reporting. Wages are paid directly by the
  business off-platform; the agreement records terms only.
- In-app messaging beyond post-acceptance contact release.
- Background checks or credential verification against third-party registries.
- Multi-language interface.

## Assumptions

- The pilot spans multiple regions with different statutory minimum wages, so the wage floor
  (FR-007) is a per-region configured value rather than a single constant; region-to-floor
  mappings are seeded as reference data, not user-editable in the MVP.
- Guardian consent (FR-014) is satisfied by an uploaded, signed consent document rather than a
  typed attestation, matching the legal weight the constitution places on minor protection.
  Verifying the signer's identity beyond the upload itself is out of scope for the MVP.
- Notifications (FR-024) are delivered in-app and by email; SMS is out of scope for the MVP.
- "Coarse location" means postal code or city centroid, per the constitution's data
  minimization principle; precise addresses are never collected from apprentices.
- A business account and a vouching organization account are distinct account types; a single
  legal entity that plays both roles registers two accounts, which keeps self-endorsement
  detection (FR-004) a simple ownership check rather than a role-merging problem.
- "Active placement" means an accepted application whose start date has passed and whose end
  date/termination has not, which gates both competency sign-off (FR-022) and Skill Passport
  entries.
- "Clear explanation" / "clear message" in the acceptance scenarios (e.g., publish refused,
  capacity exceeded) means each system-defined error condition maps to one specific,
  plain-language sentence — not a generic failure notice. The concrete error-to-sentence mapping
  is enumerated per error code in `contracts/server-actions.md`, consistent with the
  constitution's ban on raw exception text (Principle III).
