# ADDA light design

Author: Marc Strub (@mostrub)

ADDA light is a new product. It is not a reskin of `mostrub/ADDA`, and it
does not replace that repository. The live Mac Studio stack stays where it is.

Canonical repository: [`mostrub/ADDA-light`](https://github.com/mostrub/ADDA-light).
A working copy also lives under `adda-v2/` in this profile repo.

## Why a second product

Adda v1 is a forensic consumer for Renata SA's HLL-2 watch-battery line in
Itingen. It works. It also grew into a dashboard wall: Analytik, QG Werkbank,
kiosk, Parachute, Cosmograph Model Atlas, A4 Schichtbericht, iOS, watchOS,
macOS ops. That accretion is the last few weeks of UX. Ledger does not import
it.

v1 starts from a wallboard. Ledger starts from a case file. The lakehouse is
the evidence book. The UI is the bench where QG opens a DMC, pins a snapshot,
and writes a disposition that can be replayed later.

## Domain that stays

These are plant facts, not UI.

- Line: HLL-2, primary silver-oxide / alkaline / lithium watch cells. Not EV.
- Plant: Renata SA, Itingen. Locale `de-CH`. Timezone `Europe/Zurich`.
- Cell identity: DMC. Missing code is stored as `KEIN_DMC` plus a UUID.
- Inspection truth: VALTR / ViSARD (read only).
- Line verdict: EMQX MQTT (subscribe only). SPS / PLC has no write path.
- Defect classes (closed set):

  `Span`, `Zink`, `Kratzer`, `Dichtungsbraue`, `Abgeschabte_Dichtung`,
  `Ausgezogene_Dichtung`, `Elektrolyt_Flecken`, `Nicht_geschlossen`,
  `Paste`, `Separator`, `Verletzung_Becherrand`

- Adda observes. It never publishes MQTT, never writes VALTR, never commands
  the line.
- Evidence stays on the host. No cloud LLM, no cloud warehouse, no telemetry
  of measurements or images.

## Approaches considered

### A. Case-first ledger kernel (chosen)

Postgres owns cases, dispositions, audit, and the DuckLake catalog. DuckLake
owns immutable inspections, measurements, findings, and line events as
Parquet. DuckDB is the only process that writes the lake and the only
analytical engine. The UI is six forensic rooms, not a dashboard rail.

This matches the required stack and gives QG a job they can finish: open a
case, pin evidence, close a disposition.

### B. Dashboard rewrite

Keep v1 information architecture (Analytik / QG / live / parachute) and
rebuild the chrome. Faster to recognize. It is also the thing we were told
not to do.

### C. Warehouse explorer

DuckLake console plus SQL. Useful for Marc. Useless for a morning QG stand-up
that needs a closed disposition, not a catalog browser.

## Architecture

```text
ingest (loopback, token) --> Hono :5757 --> kernel
                                           |-- Postgres control + DuckLake catalog
                                           |-- DuckLake Parquet (data/lake)
                                           '-- DuckDB compute + time travel
operators (browser) -------> Vite :5759 --> same API
```

Three stores, one writer.

| Store | Owns | Does not own |
| --- | --- | --- |
| PostgreSQL `ledger` | `control` schema (cases, dispositions, audit, snapshot pins, operators). DuckLake catalog metadata. | Measurement rows. Images. |
| DuckLake | `inspections`, `measurements`, `findings`, `line_events` as Parquet under `data/lake`. Snapshots are commits. | Case workflow. Operator identity. |
| DuckDB | Attach `ducklake:postgres:... AS lake`. Analytical views. Time-travel attach by `SNAPSHOT_VERSION`. | Durable identity. A second lake master. |

Attach string (production and tests use dedicated databases):

```sql
INSTALL ducklake;
INSTALL postgres;
ATTACH 'ducklake:postgres:dbname=ledger host=127.0.0.1 user=ledger password=ledger'
  AS lake (DATA_PATH 'data/lake/', METADATA_SCHEMA 'ducklake');
```

Time travel is a second attach, read-only:

```sql
ATTACH 'ducklake:postgres:dbname=ledger host=127.0.0.1 user=ledger password=ledger'
  AS lake_at (DATA_PATH 'data/lake/', METADATA_SCHEMA 'ducklake',
              SNAPSHOT_VERSION 14, READ_ONLY);
```

Lakehouse read failures return typed `LAKEHOUSE_READ_UNAVAILABLE` and HTTP 503.
They never return an empty 200 that looks like "no defects today."

## Kernel types

Branded primitives, created only at a parse boundary:

- `Dmc`
- `CaseId`
- `SnapshotId`
- `InspectionId`
- `DispositionId`

Discriminated unions, not optional-field bags:

```ts
type CellVerdict = { kind: "io" } | { kind: "nio" } | { kind: "unknown" };

type CaseStatus =
  | { kind: "open" }
  | { kind: "pinned" }
  | { kind: "closed" };

type Finding = {
  kind: DefectClass;
  source: "inspection" | "line";
  observedAt: string; // ISO, Europe/Zurich display
};

type DispositionDecision =
  | { kind: "hold" }
  | { kind: "release" }
  | { kind: "scrap" }
  | { kind: "needs_line" };
```

Zod schemas in `packages/types` are the only API boundary. Kernel functions
take already-parsed domain types.

## Evidence tables (DuckLake)

`inspections`

| Column | Type | Meaning |
| --- | --- | --- |
| inspection_id | TEXT | Kernel-issued ULID |
| dmc | TEXT | DMC or `KEIN_DMC` |
| captured_at | TIMESTAMPTZ | Camera time |
| station | TEXT | `anode` / `cathode` / `oqc` |
| tray | TEXT | Tray id |
| slot | INTEGER | 1-based tray position |
| part_ok | BOOLEAN | VALTR-style inspection truth |
| source | TEXT | `valtr` |

`measurements`

| Column | Type | Meaning |
| --- | --- | --- |
| inspection_id | TEXT | FK by convention |
| phi_deg | DOUBLE | Orientation |
| width_mm | DOUBLE | Breite |
| height_mm | DOUBLE | Höhe |
| span_mm | DOUBLE | Spanne |

`findings`

| Column | Type | Meaning |
| --- | --- | --- |
| inspection_id | TEXT | |
| defect_class | TEXT | One of the eleven |
| score | DOUBLE | Detector score, 0..1 |

`line_events`

| Column | Type | Meaning |
| --- | --- | --- |
| event_id | TEXT | ULID |
| dmc | TEXT | |
| observed_at | TIMESTAMPTZ | Broker time |
| verdict | TEXT | `io` / `nio` / `unknown` |
| source | TEXT | `mqtt` |

Ingest is append-only. Updates are new rows. Corrections are new inspections
plus an audit row in Postgres that names the superseded id.

## Control tables (Postgres)

`control.operators` — local operator names. No cloud identity.

`control.cases` — `id`, `dmc`, `status`, `title`, `opened_at`, `opened_by`,
`closed_at`, `snapshot_id` (nullable pin).

`control.dispositions` — `id`, `case_id`, `decision`, `note`, `decided_at`,
`decided_by`. One open case may collect several notes. The latest row is the
standing decision.

`control.audit_events` — `id`, `at`, `actor`, `action`, `payload_json`. Every
ingest batch, case open, pin, and disposition writes one row.

`control.snapshot_pins` — `id`, `snapshot_id`, `case_id`, `label`, `pinned_at`.
The numeric DuckLake snapshot becomes a named pin QG can reopen.

## API

Prefix `LEDGER_`. Ports 5757 (API + built SPA) and 5759 (Vite, dev only).

| Method | Path | Role |
| --- | --- | --- |
| GET | `/health` | Process + Postgres ping |
| GET | `/api/lake/status` | Current snapshot, table counts, catalog ok |
| POST | `/_internal/ingest/inspections` | Loopback + `LEDGER_INGEST_TOKEN` |
| POST | `/_internal/ingest/line-events` | Same gate |
| GET | `/api/cells/:dmc` | Dossier: inspections, findings, line events, open case |
| GET | `/api/cases` | Inbox, filter by status |
| POST | `/api/cases` | Open a case for a DMC |
| GET | `/api/cases/:id` | Case file + pin + dispositions |
| POST | `/api/cases/:id/pin` | Pin current DuckLake snapshot |
| POST | `/api/cases/:id/dispositions` | Write a decision |
| GET | `/api/chronik` | Time-ordered evidence, optional `dmc` / window |
| GET | `/api/schicht` | Shift yield, defect mix, IO/NIO |
| GET | `/api/see/snapshots` | DuckLake `snapshots()` |
| GET | `/api/see/at/:snapshotId/cells/:dmc` | Time-travel dossier |

Mutation routes other than ingest require `LEDGER_OPERATOR_TOKEN` or
loopback. Forwarded headers are ignored. JSON bodies are byte-capped before
parse. Missing ingest token fail-closes writes.

Provenance: every analytical payload includes `_provenance` with store,
snapshot id, and query name.

## Operator rooms (UI)

Swiss German copy. Numbers via `de-CH` (`1'247`, `2,7 %`). No `ß`. No
ASCII-umlaut fakes. No battery / zap / gauge icons.

This is a file bench, not a control room.

| Route | Room | Job |
| --- | --- | --- |
| `/akten` | Akten | Open cases, newest first |
| `/akten/:id` | Akte | One case: cell, pin, dispositions, audit |
| `/zellen/:dmc` | Zelle | Dossier. Open or jump to a case |
| `/chronik` | Chronik | Evidence stream |
| `/bank` | Bank | Disposition queue: NIO cells without a closed case |
| `/see` | See | Lake health, snapshots, open a pin |
| `/schicht` | Schicht | Shift yield and defect mix |

Empty and 503 states stay honest. "Lakehouse nicht erreichbar" is a first-class
screen, not a spinner that pretends the line is clean.

Visual language: paper, ink, archive red for NIO, graphite for IO. Serif
titles, sans body. No Cosmograph canvas, no chat dock, no kiosk wall, no A4
print chrome.

## What v2 will not ship

- Native iOS / watchOS / macOS apps
- Apple Foundation Models / Parachute
- Cosmograph / Model Atlas / `/viz/*`
- launchd, Tailscale Serve, NAS blob volume
- Ports 4747 / 4748 / 4749 and env prefix `ADDA_`
- Cloud evidence or Netlify Database for production rows (local Postgres only)
- Any file copied from `mostrub/ADDA`

A deterministic seed writes three Zurich shifts of synthetic HLL-2-shaped
rows so the bench can be used without the plant. Seed data is labeled
`source=seed`. It is never presented as live VALTR.

## Testing

Kernel tests run against `ledger_test` (name must contain `test`). They
create a dedicated DuckLake schema, write rows, pin a snapshot, ingest a
correction, and prove time travel returns the earlier dossier.

API tests hit Hono with the real kernel. Web tests cover formatters and the
case-status state machine. Browser verification walks Akten → Zelle → Bank →
See on the seeded set.

## Error handling

| Condition | Result |
| --- | --- |
| Lake attach or query fails | `LAKEHOUSE_READ_UNAVAILABLE`, HTTP 503 |
| Unknown DMC | HTTP 404, empty dossier is not implied |
| Ingest without token or off loopback | HTTP 401 / 403, no write |
| Invalid defect class | HTTP 422 at the Zod boundary |
| Pin against a missing snapshot | HTTP 409 |

## Success

A QG operator can open a NIO cell, see inspection + line verdict on one
page, pin the lake at that moment, and close `scrap` or `hold` with an
audit row. A later operator can reopen the pin and see the same findings.
That path is tested. The live ADDA repo is untouched.
