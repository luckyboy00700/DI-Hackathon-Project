# Implementation Plan: Apprenticeship Matching & Placement MVP

**Branch**: `001-apprenticeship-matching-mvp` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-apprenticeship-matching-mvp/spec.md`

## Summary

A server-rendered web application where verified businesses publish apprenticeship placements
and students discover them by proximity and trade. Trust rules — verification, age gating,
contact-detail release, capacity, competency sign-off — are enforced in the database via
row-level security and constrained transactions, not in the UI. Delivery target is a 48-hour
hackathon build with a demo-ready end-to-end flow.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode

**Primary Dependencies**: Next.js 15 (App Router), React 19 with Server Components/Server
Actions, Zod, Tailwind CSS v4, shadcn/ui, React PDF renderer (server-side), Resend (transactional
email)

**Storage**: Supabase Postgres 17 + PostGIS; Supabase Storage for uploaded guardian consent
documents

**Testing**: Vitest (unit, `lib/domain/**`), Supabase local / Testcontainers Postgres
(integration — RLS policies and constraints), Playwright (E2E)

**Target Platform**: Web, mobile-first (375px floor), deployed to Vercel + Supabase managed

**Project Type**: Web application (single Next.js app; no separate frontend/backend split —
Server Components and Server Actions replace a REST API tier)

**Performance Goals**: LCP ≤ 2.5s and search API p95 ≤ 500ms, both on mobile simulated 4G, per
constitution Principle IV

**Constraints**: Any database query ≤ 100ms (explain-plan reviewed if exceeded); initial JS
payload ≤ 200KB gzipped per route; RLS default-deny on every table; no client-side-only
enforcement of age gating, verification, or contact-detail release

**Scale/Scope**: Pilot scale — hundreds of placements, low thousands of users. This assumption
is what makes single-region Postgres and no caching layer defensible; revisit at ~50k
placements.

### Stack rationale

| Concern | Choice | Why this, not the alternative |
| --- | --- | --- |
| Language | TypeScript 5.x, strict mode | One language across server and client; strict mode is the cheapest defense against the `any`-escapes Principle I forbids. |
| Framework | Next.js 15 (App Router), React 19, Server Components | Server Components keep filter/search logic and secrets on the server, which directly serves Principle V. Server Actions remove a whole API layer we do not have time to build — with the trade-off that they are framework-coupled, accepted for a hackathon. |
| Database | Supabase Postgres 17 + PostGIS | Postgres gives real constraints (unique, check, exclusion) so trust rules are enforced by the engine, not by hope. PostGIS gives correct geodesic distance; the alternative — Haversine in application code — cannot use a spatial index and breaks Principle IV's 100ms query budget past a few thousand rows. |
| Auth | Supabase Auth (email OTP) | No password storage, no reset flow to build. OTP is also less hostile on a phone than a password for our contractor users. |
| Authorization | Postgres Row-Level Security | Principle V requires data-layer enforcement. RLS means a bug in a page component cannot leak another user's applications. |
| Styling | Tailwind CSS v4 + shadcn/ui | Design tokens in one place; a fixed component set makes Principle III enforceable rather than aspirational. |
| Validation | Zod schemas, shared client/server | One schema definition drives form validation, Server Action parsing, and inferred types. Client-side validation is UX only; the server re-parses everything. |
| Testing | Vitest (unit), Testcontainers/Supabase local (integration), Playwright (E2E) | Principle II forbids mocking the database — RLS policies and check constraints only fail against a real instance. |
| Documents | React PDF renderer, server-side | Agreements render deterministically from the same data the DB holds; no headless browser to provision. |
| Email | Resend | FR-024 requires email alongside in-app notifications (guardians in particular may not have the app open). Resend's API is a few lines from a Next.js Server Action and needs no SMTP setup, unlike Supabase's built-in mail (auth emails only, not arbitrary transactional sends) or a heavier ESP we don't have time to configure. |
| Hosting | Vercel + Supabase managed | Preview deploys per PR give us the surface to measure the performance budgets. |
| Observability | Vercel Analytics + Lighthouse CI on preview | Budgets are measured, per Principle IV. |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
| --- | --- | --- |
| I — Code Quality | Domain logic in `lib/domain/**`, importable without React or Next | PASS |
| I — Code Quality | Zod parse at every Server Action and route handler boundary | PASS |
| II — Test-First | Failing tests written first for the five classes Principle II names: eligibility, matching/ranking, agreement generation, endorsement signing, and age rules (plus capacity, tested as a related concurrency concern) | PASS |
| II — Test-First | Data-access tests run against a real Postgres instance | PASS |
| II — Test-First | 80% coverage on business logic | **DEFERRED** — see Complexity Tracking |
| III — UX | Single component library, tokens only, WCAG 2.2 AA, 375px verified | PASS |
| III — UX | Loading / empty / error / success states for every route | PASS |
| IV — Performance | Indexes on `placements(status, trade_category)` and GIST on location | PASS |
| IV — Performance | Search paginated server-side, 20 per page | PASS |
| IV — Performance | Budgets verified in CI | **DEFERRED** — verified once on preview deploy |
| V — Safety | Age gating in the SQL predicate, not the component | PASS |
| V — Safety | RLS on every table; default deny | PASS |
| V — Safety | Contact fields excluded from the pre-acceptance view | PASS |
| V — Safety | Audit table written in the same transaction as the state change | PASS |
| VI — Data Minimization | Postal-code centroid stored; no street addresses for apprentices | PASS |
| VI — Data Minimization | No PII in URLs, logs, or analytics | PASS |

No principle is violated. Two gates are deferred under the Delivery Constraints (Hackathon
Mode) clause, which the constitution permits by name. Both deferrals are recorded in Complexity
Tracking below.

**Post-Phase 1 re-check**: The data model (RLS policies, CHECK constraints, `FOR UPDATE`
capacity locking) and contracts introduce no new tables, external services, or trust-bearing
logic outside `lib/domain/**` and the database. Gate statuses above are unchanged after design.

## Project Structure

### Documentation (this feature)

```text
specs/001-apprenticeship-matching-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
app/
  (public)/                 # landing, browse, placement detail — cacheable
  (apprentice)/              # profile, applications, skill passport
  (business)/                # placements, applicant review, sign-off
  (org)/                     # vouching organization endorsements
  api/                       # webhooks only; everything else is Server Actions
components/
  ui/                        # shadcn primitives — the ONLY styling surface
  features/                  # composed, feature-specific components
lib/
  domain/                    # pure business logic — no framework imports
    eligibility.ts           # age-at-start-date predicate (FR-010)
    matching.ts               # ranking and filter predicates
    agreement.ts              # agreement assembly from placement + application
  db/                        # typed queries, generated types
  validation/                # Zod schemas shared client/server
supabase/
  migrations/                # tables, constraints, RLS policies, indexes
  seed.sql                   # demo data
tests/
  unit/                      # lib/domain — fast, no I/O
  integration/               # RLS policies, constraints, transactions
  e2e/                       # Playwright: apply→accept→sign-off, publish gating
```

**Structure Decision**: Single Next.js web application (no separate frontend/backend project).
Business logic lives in `lib/domain/**`, framework-free and independently unit-testable per
Principle I; the database (Supabase Postgres) is the authorization boundary per Principle V, so
there is no separate "backend" tier to stand up.

## Complexity Tracking

| Deviation | Why accepted | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Coverage gate lowered to critical paths only (100% on eligibility, age gating, agreement generation; best-effort elsewhere) | 48-hour window; the constitution's Delivery Constraints (Hackathon Mode) clause names this exact relaxation | Full 80% across UI code costs demo-flow time for low defect yield |
| Performance budgets checked once on preview, not in CI | Lighthouse CI setup cost exceeds its 2-day value; the constitution's Delivery Constraints clause names this exact relaxation | Skipping measurement entirely would violate Principle IV outright |
| PostGIS rather than a lat/lng bounding box | Correct distances and an indexable predicate | Application-side Haversine cannot use an index and breaks the 100ms query budget |
| Server Actions instead of a REST layer | Removes an entire tier and its tests | A REST API is more portable but is unbuilt scaffolding we cannot staff in 48 hours |

### Reconciliation after implementation (T085)

What actually happened against the entries above, plus deviations that arose during the build:

| Item | Planned | Actual |
| --- | --- | --- |
| Coverage gate | 100% on eligibility / age gating / agreement generation | Held. `eligibility.ts`, `agreement.ts` and `endorsement.ts` each have dedicated unit suites written test-first; the vitest coverage thresholds pin all three at 100%. |
| Performance budgets | Verified once on a deployed preview | **Deviated**: nothing was deployed, so budgets were measured against a local production build instead. Initial JS per route is 103–172 kB against the ≤200KB budget (heaviest: `/applications/[id]/consent`). LCP 116ms / CLS 0 / search query 66ms — but on localhost, **not** the mobile-4G mid-tier device the budget specifies. The LCP and INP figures are therefore not yet a real pass; the bundle and query numbers are. |
| PostGIS | Geodesic distance, GIST-indexed | Held. `search_placements()` uses `ST_DWithin` on a GIST-indexed geography column. |
| Server Actions instead of REST | No API tier | Held. The only route handler is the agreement PDF, which needs a binary response. |
| Postgres version | 16 | 17 — the current Supabase CLI refuses 16 locally. No impact on anything used. |
| Package manager / port | pnpm, port 3000 | npm, port 3100. pnpm was not installed; port 3000 was already occupied on the dev machine. |
| E2E scope | Two demo-critical flows | Held, and both pass. They required building sign-in (absent from the task list entirely) and the US4 competency slice, since the second flow ends in a sign-off. |
| Migration numbering | Endorsements at 0017 | Endorsements landed at 0020; 0017–0019 were consumed by fixes found during E2E (applicant visibility, participant visibility, RLS recursion). |

**Debt carried out of this build**, none of it covered by the Hackathon Mode clause:

- Runtime vitals have not been measured under the specified mobile/4G conditions, only on
  localhost. This is the one Principle IV gate still genuinely open.
- No deployment exists, so nothing has been exercised against managed Supabase or a real Resend
  key; email delivery is skipped when `RESEND_API_KEY` is unset and has never actually sent.
- Guardian consent stores an uploaded document but does not verify the signer's identity — an
  MVP boundary already stated in the spec's Assumptions, not a regression.

## Risks

- **RLS complexity** is where this build fails if it fails. Policies are written and tested
  first, before any UI exists.
- **Demo data realism** — a geo search demo with three seeded rows proves nothing. Seed at 10x
  pilot scale so the p95 measurement is meaningful.

## Progress

- [x] Phase 0 research complete (`research.md`)
- [x] Phase 1 design complete (`data-model.md`, `contracts/`, `quickstart.md`)
- [x] Constitution Check — initial: PASS
- [x] Constitution Check — post-design: PASS
- [x] Phase 2 task generation (`/speckit-tasks`)
- [x] Implementation (`/speckit-implement`) — 85/85 tasks; see Reconciliation above for the
      deviations and the remaining Principle IV gap
