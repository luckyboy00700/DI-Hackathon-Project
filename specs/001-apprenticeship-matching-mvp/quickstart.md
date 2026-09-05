# Quickstart: Apprenticeship Matching & Placement MVP

Reproducible in under 10 minutes on a clean checkout.

## Prerequisites

- Node.js 20+ and npm
- Docker running (the Supabase local stack needs it)
- The Supabase CLI comes in as a dev dependency — no separate global install needed

The dev server runs on **port 3100**, not 3000, to avoid colliding with other local services.

## Setup

```bash
npm install
npm run db:start
npm run db:reset          # applies supabase/migrations/*, then supabase/seed.sql
npm run dev              # http://localhost:3100
```

`db:reset` seeds at 10x pilot scale per the plan's Risks section (≈320 placements across ~40
verified businesses), so proximity search and pagination behave like the pilot, not like a
three-row demo.

## Signing in

Sign-in is a 6-digit email code — there is no password. Locally the email never leaves your
machine: open the mail catcher at **http://localhost:54324**, open the newest message, and copy
the code.

Seeded accounts to sign in as:

| Email | Who they are |
| --- | --- |
| `rahman.electric@example.test` | Verified business — can publish |
| `newshop@example.test` | Unverified business — publishing is blocked |
| `yusuf@example.test` | Apprentice, under 18 — age gating and guardian consent apply |
| `amina@example.test` | Apprentice, over 18 — sees age-restricted placements |
| `masjid.alnoor@example.test` | Vouching organization — records verification and endorsements |

## Validate the feature end-to-end

1. **Business verification & publishing** (User Story 1) — sign in as a seeded unverified
   business, attempt to publish a placement (expect `BUSINESS_NOT_VERIFIED`), then sign in as
   ops/admin seed user and mark it verified, then publish successfully.
2. **Apprentice search & discovery** (User Story 2) — sign in as a seeded under-18 apprentice,
   search by trade + distance, confirm age-restricted placements never appear and results are
   ordered by proximity with distance shown.
3. **Application → consent → agreement** (User Story 3) — apply as the minor apprentice, attempt
   acceptance as the mentor before consent exists (expect `GUARDIAN_CONSENT_REQUIRED`), upload a
   consent document and record it, accept, confirm both parties see an identical agreement and
   that contact fields were `NULL` before this step.
4. **Skill Passport sign-off** (User Story 4) — as the mentor, sign a competency against the now-
   active placement; confirm it appears on the apprentice's Skill Passport read-only share link
   and cannot be edited from the apprentice's session.
5. **Endorsements** (User Story 5) — as a seeded vouching organization, endorse the apprentice
   and a business; attempt to endorse a business the organization owns and confirm
   `SELF_ENDORSEMENT_REJECTED`.

## Run tests

```bash
npm run test:unit         # 37 tests — lib/domain/**, no I/O
npm run test:integration  # 91 tests — RLS, constraints, transactions vs local Supabase
npm run test:e2e          # 3 tests — Playwright, the two demo-critical flows
```

`test:e2e` drives the real sign-in flow, reading each code from the local mail catcher, so it
needs `db:start` running. It starts the dev server itself.

## Performance budgets

`npm run build` prints First Load JS per route — the figure the ≤200KB budget applies to.
Runtime vitals are measured on the production build (`npm run build && npm run start`).

## Contracts and data model reference

See [contracts/server-actions.md](contracts/server-actions.md) for request/response shapes and
error codes, and [data-model.md](data-model.md) for table definitions, constraints, and state
transitions referenced above.
