# Adda Ledger implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Adda Ledger, a case-first forensic evidence kernel for HLL-2, using Postgres as catalog and control plane, DuckLake as the evidence book, and DuckDB as the only analytical engine.

**Architecture:** One kernel process attaches DuckLake through `ducklake:postgres:` and writes Parquet under `adda-v2/data/lake`. Hono exposes ingest and operator APIs. The React bench has six rooms (Akten, Zelle, Chronik, Bank, See, Schicht). The existing `mostrub/ADDA` tree is never copied or overwritten.

**Tech Stack:** Node 22, TypeScript 5 strict, Hono 4, React 19, Vite, Tailwind 4, Zod, Vitest, `pg`, `@duckdb/node-api` or `duckdb`, PostgreSQL 16, DuckLake extension, DuckDB postgres extension.

## Global Constraints

- Evidence stays on the host. No cloud LLM, no Netlify Database for production rows, no telemetry of measurements.
- Env prefix `LEDGER_`. Ports `5757` (API) and `5759` (Vite).
- Locale `de-CH`, timezone `Europe/Zurich`. No `ß`. No ASCII-umlaut fakes.
- Closed defect set of eleven classes. Unknown class is a 422, not a string column.
- Read-only plant contract: ingest endpoints never imply a write back to VALTR or MQTT.
- Dedicated test DSN database name must contain `test`. Fixture code refuses anything else.
- No files copied from `mostrub/ADDA`. No Cosmograph, Parachute, kiosk, or A4 print chrome.
- No `Battery*`, `Zap`, `Power`, `Plug`, `Leaf`, `Gauge` icons.
- Lakehouse failures are HTTP 503 with `LAKEHOUSE_READ_UNAVAILABLE`, never an empty 200.
- Product code lives only under `adda-v2/`.

## File map

- `adda-v2/package.json` — workspaces, scripts
- `adda-v2/tsconfig.base.json` — strict, noUncheckedIndexedAccess
- `adda-v2/packages/types/src/index.ts` — Zod + branded types
- `adda-v2/packages/kernel/src/*.ts` — lake, ingest, cases, analytics, seed
- `adda-v2/packages/design/src/tokens.css` — paper/ink tokens
- `adda-v2/apps/api/src/*.ts` — Hono app
- `adda-v2/apps/web/src/**` — six rooms
- `adda-v2/tests/**` — kernel and API tests against `ledger_test`

---

### Task 1: Types and defect register

**Files:**
- Create: `adda-v2/packages/types/src/index.ts`
- Create: `adda-v2/packages/types/src/defects.ts`
- Create: `adda-v2/packages/types/src/brands.ts`
- Test: `adda-v2/tests/types/defects.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Dmc`, `CaseId`, `parseDmc`, `DEFECT_CLASSES`, `isDefectClass`, `inspectionIngestSchema`, `lineEventIngestSchema`, `openCaseSchema`, `dispositionSchema`

- [ ] **Step 1: Write the failing test** for unknown defect rejection and DMC branding
- [ ] **Step 2: Run it and confirm it fails** because the module is missing
- [ ] **Step 3: Implement brands, defect register, Zod ingest schemas**
- [ ] **Step 4: Run the test and confirm it passes**
- [ ] **Step 5: Commit** `feat(ledger): add branded types and defect register`

### Task 2: Postgres control schema

**Files:**
- Create: `adda-v2/packages/kernel/src/postgres.ts`
- Create: `adda-v2/packages/kernel/src/control-schema.sql`
- Test: `adda-v2/tests/kernel/control.test.ts`

**Interfaces:**
- Consumes: `LEDGER_PG_URL` (`postgres://ledger:ledger@127.0.0.1:5432/ledger`)
- Produces: `assertTestDatabase(name)`, `migrateControl(pool)`, `ControlStore`

- [ ] **Step 1: Write a test that refuses a non-test database name**
- [ ] **Step 2: Confirm it fails**
- [ ] **Step 3: Implement migrate + case/audit writes**
- [ ] **Step 4: Confirm tests pass against `ledger_test`**
- [ ] **Step 5: Commit** `feat(ledger): add postgres control schema`

### Task 3: DuckLake attach and evidence tables

**Files:**
- Create: `adda-v2/packages/kernel/src/lake.ts`
- Test: `adda-v2/tests/kernel/lake.test.ts`

**Interfaces:**
- Consumes: Postgres catalog, `LEDGER_LAKE_PATH`
- Produces: `openLake()`, `closeLake()`, `currentSnapshot()`, `listSnapshots()`, `attachAtSnapshot(id)`

- [ ] **Step 1: Write a test that attaches DuckLake to `ledger_test`, creates the four evidence tables, inserts one inspection, and reads `snapshots()`**
- [ ] **Step 2: Confirm it fails**
- [ ] **Step 3: Implement attach + schema bootstrap + snapshot listing**
- [ ] **Step 4: Confirm the test writes Parquet/catalog rows and returns a snapshot id**
- [ ] **Step 5: Commit** `feat(ledger): attach ducklake via postgres catalog`

### Task 4: Ingest and time travel

**Files:**
- Create: `adda-v2/packages/kernel/src/ingest.ts`
- Create: `adda-v2/packages/kernel/src/dossier.ts`
- Test: `adda-v2/tests/kernel/ingest-timetravel.test.ts`

**Interfaces:**
- Consumes: `openLake`, typed ingest payloads
- Produces: `ingestInspections()`, `ingestLineEvents()`, `loadDossier(dmc)`, `loadDossierAt(dmc, snapshotId)`

- [ ] **Step 1: Write a test that ingests a NIO cell, records a later IO correction, and proves `loadDossierAt` on the first snapshot still shows NIO**
- [ ] **Step 2: Confirm it fails**
- [ ] **Step 3: Implement append-only ingest with commit messages and time-travel attach**
- [ ] **Step 4: Confirm the test passes**
- [ ] **Step 5: Commit** `feat(ledger): ingest evidence and time-travel dossiers`

### Task 5: Cases, pins, dispositions

**Files:**
- Create: `adda-v2/packages/kernel/src/cases.ts`
- Test: `adda-v2/tests/kernel/cases.test.ts`

**Interfaces:**
- Consumes: `ControlStore`, `currentSnapshot`
- Produces: `openCase`, `pinCase`, `addDisposition`, `listOpenCases`, `loadCase`

- [ ] **Step 1: Write a test that opens a case, pins snapshot N, adds `scrap`, and reloads the pin**
- [ ] **Step 2: Confirm it fails**
- [ ] **Step 3: Implement case workflow + audit rows**
- [ ] **Step 4: Confirm the test passes**
- [ ] **Step 5: Commit** `feat(ledger): case pins and dispositions`

### Task 6: Shift analytics

**Files:**
- Create: `adda-v2/packages/kernel/src/analytics.ts`
- Test: `adda-v2/tests/kernel/analytics.test.ts`

**Interfaces:**
- Consumes: lake connection
- Produces: `shiftReport({ from, to })` with yield, defect mix, `_provenance`

- [ ] **Step 1: Write a test on seeded rows that yield is IO / (IO+NIO) and provenance includes snapshot id**
- [ ] **Step 2: Confirm it fails**
- [ ] **Step 3: Implement parameterized DuckDB SQL**
- [ ] **Step 4: Confirm the test passes**
- [ ] **Step 5: Commit** `feat(ledger): shift yield from ducklake`

### Task 7: Seed

**Files:**
- Create: `adda-v2/packages/kernel/src/seed.ts`
- Test: `adda-v2/tests/kernel/seed.test.ts`

**Interfaces:**
- Produces: `seedLedger({ days: 1 })` writing three Zurich shifts, all eleven defect classes, labeled `source=seed`

- [ ] **Step 1: Write a test that seed is deterministic and marks source=seed**
- [ ] **Step 2: Implement the generator**
- [ ] **Step 3: Commit** `feat(ledger): deterministic hll-2 shaped seed`

### Task 8: Hono API

**Files:**
- Create: `adda-v2/apps/api/src/app.ts`
- Create: `adda-v2/apps/api/src/index.ts`
- Create: `adda-v2/apps/api/src/config.ts`
- Create: `adda-v2/apps/api/src/routes/*.ts`
- Test: `adda-v2/tests/api/app.test.ts`

**Interfaces:**
- Produces: routes listed in the spec, ingest fail-closed without token

- [ ] **Step 1: Write API tests for health, 401 ingest, cell dossier, case open**
- [ ] **Step 2: Implement Hono app with kernel**
- [ ] **Step 3: Commit** `feat(ledger): hono operator and ingest api`

### Task 9: Web bench

**Files:**
- Create: `adda-v2/apps/web/**`
- Test: `adda-v2/apps/web/src/lib/format.test.ts`

**Interfaces:**
- Consumes: `/api/*`
- Produces: six rooms in Swiss German, honest empty/503 states

- [ ] **Step 1: Scaffold Vite + React + Tailwind tokens**
- [ ] **Step 2: Implement rooms Akten, Akte, Zelle, Chronik, Bank, See, Schicht**
- [ ] **Step 3: Commit** `feat(ledger): forensic bench ui`

### Task 10: Verify

- [ ] Run `npm test` in `adda-v2`
- [ ] Start API + web, walk Akten → Zelle → Bank → See
- [ ] Confirm lake status shows a real DuckLake snapshot
- [ ] Commit any fixes

## Spec coverage

| Spec section | Task |
| --- | --- |
| Domain / defects | 1 |
| Postgres control | 2, 5 |
| DuckLake attach | 3 |
| Ingest + time travel | 4 |
| Cases / pins | 5 |
| Schicht analytics | 6 |
| Seed | 7 |
| API | 8 |
| UI rooms | 9 |
| Testing / 503 | 4, 8, 10 |
