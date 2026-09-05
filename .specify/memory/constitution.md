<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: none (first fill of template placeholders)
- Added sections:
  - I. Code Quality & Clean Architecture
  - II. Test-First Discipline
  - III. UX Consistency & Accessibility
  - IV. Performance Budgets
  - V. Trust, Safety & Minor Protection
  - VI. Data Minimization
  - Delivery Constraints (Hackathon Mode)
  - Development Workflow
  - Governance (amendment procedure, versioning policy, compliance review)
- Removed sections: none
- Templates requiring updates: not modified by this command (dependent templates read
  this file at runtime — see Scope Guard). Recommend a follow-up check of
  .specify/templates/plan-template.md's Constitution Check gate against Principle V
  and the Delivery Constraints section.
- Follow-up TODOs: none — RATIFICATION_DATE set to the date of this command's execution
  since no prior ratified version existed.
-->

# Amanah Apprenticeship Board Constitution

## Purpose

Amanah Apprenticeship Board connects vetted trade and creative-studio mentors with students
seeking paid apprenticeships. The platform handles minors, wage agreements, and community
reputation. A defect here is not a broken feature — it is a broken trust relationship in a
small community where reputation does not recover. These principles are therefore binding,
not aspirational.

## Core Principles

### I. Code Quality & Clean Architecture

Business rules MUST live in framework-agnostic modules; UI components MUST NOT contain
matching, eligibility, or agreement-generation logic. Every module has one reason to change.

Non-negotiable rules:

- No function longer than 50 lines; no file longer than 400 lines. Exceeding either is a
  refactor trigger, not a review comment.
- All external input (form bodies, query params, webhook payloads) MUST be parsed through a
  declared schema at the boundary. Unvalidated input reaching a data layer is a blocking defect.
- No `any`-typed values crossing a module boundary. Type escapes MUST be justified in a code
  comment naming the constraint that forced them.
- Lint and type checks run in CI and block merge. Warnings are errors.
- Dead code, commented-out code, and unused dependencies are deleted, not archived.

Rationale: Matching and eligibility rules will change weekly during pilot. If they are
entangled with rendering, every policy change becomes a UI regression risk.

### II. Test-First Discipline

Tests are written before the implementation for all logic in the following classes:
eligibility, matching/ranking, agreement generation, endorsement signing, and any rule
involving an applicant's age.

Non-negotiable rules:

- Red-green-refactor is mandatory for the above classes. The failing test MUST be visible in
  the commit history before the passing implementation.
- Minimum 80% line coverage on business-logic modules. UI presentation code is exempt from the
  coverage gate but not from integration coverage.
- Every bug fix begins with a regression test that reproduces the bug.
- Each user-facing flow named in a spec has at least one end-to-end test covering the primary
  success path and one covering the primary failure path.
- Tests MUST NOT mock the database for data-access tests. Use a real ephemeral instance;
  mocked persistence hides constraint and authorization failures, which are exactly the
  failures that leak private data.

Rationale: Age gating and wage-floor rules have legal consequences. A mocked test that passes
against an assumption is worse than no test.

### III. UX Consistency & Accessibility

The interface MUST be usable by a 17-year-old on a mid-range phone with one hand and by a
55-year-old contractor between service calls.

Non-negotiable rules:

- All UI is composed from a single shared component library. Ad-hoc styling of buttons,
  inputs, cards, or dialogs is prohibited; extend the library instead.
- Design tokens (color, spacing, typography, radius) are defined once and referenced.
  Hard-coded hex values or pixel spacing in feature code is a blocking defect.
- WCAG 2.2 Level AA is the floor: 4.5:1 text contrast, visible focus states, keyboard
  operability for every interactive element, labeled form controls.
- Mobile-first. Every screen MUST be verified at 375px width before merge.
- Every state is designed, not defaulted: loading, empty, error, and success. A screen that
  can render blank with no explanation is incomplete.
- Errors are actionable and written in plain language. No raw exception text, no error codes
  without a human sentence.

Rationale: The target users are not the developers. Consistency is the cheapest substitute for
onboarding and support staff we do not have.

### IV. Performance Budgets

Budgets are measured, not estimated. A change that breaches a budget does not merge.

| Metric | Budget | Measured on |
|---|---|---|
| Largest Contentful Paint | ≤ 2.5s | Mobile, simulated 4G, mid-tier device |
| Interaction to Next Paint | ≤ 200ms | Same |
| Cumulative Layout Shift | ≤ 0.1 | Same |
| Search/filter API p95 | ≤ 500ms | Server-side, warm cache |
| Any database query | ≤ 100ms | Explain plan reviewed if exceeded |
| Initial JS payload per route | ≤ 200KB gzipped | Build output |

Additional rules:

- Every query filtered by geography, trade category, or status MUST be backed by an index.
  Sequential scans on the placements table are a blocking defect.
- Lists that can exceed 50 rows MUST be paginated or virtualized at the data layer. Fetching
  all rows and filtering client-side is prohibited.
- Images are served responsively and lazily below the fold.

Rationale: The pilot audience browses on personal phones over cellular data. A 2MB bundle is
not a performance nit; it is an access barrier.

### V. Trust, Safety & Minor Protection

This principle overrides schedule. No exception is granted for demo deadlines.

Non-negotiable rules:

- An applicant's date of birth determines eligibility. Placements flagged as restricted (heavy
  equipment, high-voltage, confined space, or any hazardous occupation classification) MUST be
  filtered out server-side for under-18 applicants. Client-side filtering alone is a blocking
  defect.
- Under-18 applications require a recorded guardian consent artifact before an agreement can be
  generated.
- No unmediated exchange of personal contact details before both parties have accepted a
  placement. Contact data is released by the system, not typed into a message body.
- Mentor accounts cannot transact until verification status is verified. Verification state is
  server-authoritative and never inferred from the client.
- Every endorsement, agreement acceptance, and verification decision writes an immutable audit
  record: actor, subject, action, timestamp.
- Authorization is enforced at the data layer with row-level policies. Application code MUST
  NOT be the only thing standing between a user and another user's data.

Rationale: The platform's product is trust. One safety failure involving a minor ends the
project regardless of code quality.

### VI. Data Minimization

Collect the least data that makes the match work.

Non-negotiable rules:

- Precise home addresses are never stored for apprentices. Store a coarse location (postal
  code or city centroid) and compute proximity from it.
- Personally identifying fields are never placed in URLs, query strings, logs, or analytics
  events.
- Community vouching records store the endorsing organization and a decision, not free-text
  character assessments about a person.
- Any new personal field added to the schema requires a written justification in the feature
  spec naming the concrete matching decision it enables.

Rationale: Community platforms accumulate sensitive social data by default. Data never
collected cannot be leaked, subpoenaed, or misused.

## Delivery Constraints (Hackathon Mode)

A 48-hour build cannot satisfy every gate. The following are explicitly relaxed and tracked as
debt in `specs/*/plan.md` under Complexity Tracking:

- Coverage gate reduced from 80% to: 100% on eligibility, age gating, and agreement generation;
  best-effort elsewhere.
- End-to-end tests limited to the two demo-critical flows.
- Performance budgets verified once against the deployed preview rather than in CI.

The following are never relaxed, in any mode:

- Principle V in its entirety.
- Server-side authorization and row-level policies.
- Boundary input validation.
- No unvalidated secrets or keys committed to the repository.

Any relaxation not listed above requires an amendment, not a decision in the moment.

## Development Workflow

- **Branching**: trunk-based. `main` is always deployable. Work happens on
  `feat/<scope>-<short-desc>`, `fix/<scope>-<short-desc>`, `chore/…`, `docs/…`. Branches live
  under 24 hours during the sprint.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `perf:`, `docs:`,
  `chore:`). Subject in imperative mood, ≤ 72 characters. Body explains why, not what.
- **Pull requests**: every PR states which principles it touches and how it complies. A PR
  that changes eligibility, age gating, or authorization requires a second reviewer. CI (lint,
  types, unit, integration) must be green before merge.
- **Spec-driven flow**: `/speckit.constitution` → `/speckit.specify` → `/speckit.plan` →
  `/speckit.tasks` → `/speckit.implement`. Code that has no corresponding requirement in a spec
  does not get written.

## Governance

This constitution supersedes all other development practices, including verbal agreements made
under deadline pressure.

- Amendments require a written proposal stating the principle affected, the rationale, and the
  migration impact on existing code. Approval requires consensus of active maintainers.
- Versioning follows semantic versioning:
  - **MAJOR** — a principle is removed or redefined in a way that invalidates existing
    compliant code.
  - **MINOR** — a new principle or a materially expanded requirement is added.
  - **PATCH** — clarification, wording, or typo fixes with no change in obligation.
- Compliance review happens at every PR and at the Constitution Check gate in each `plan.md`.
  Violations are either fixed or recorded in Complexity Tracking with an explicit justification
  and a simpler alternative that was rejected.
- Runtime guidance for AI agents lives in the agent context file; it may refine but never
  contradict this document.

**Version**: 1.0.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
