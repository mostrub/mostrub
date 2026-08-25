# ADDA light

Private product repo: [`mostrub/ADDA-light`](https://github.com/mostrub/ADDA-light).

ADDA light is a local HLL-2 line floor. Postgres holds cases and the DuckLake
catalog. DuckLake holds inspections. DuckDB is the only engine that writes or
time-travels the lake.

It does not replace [`mostrub/ADDA`](https://github.com/mostrub/ADDA).

## Stack

| Store | Role |
| --- | --- |
| PostgreSQL 16 | `control` schema plus DuckLake catalog |
| DuckLake | `inspections`, `measurements`, `findings`, `line_events` |
| DuckDB | Attach `ducklake:postgres:…`, analytics, `SNAPSHOT_VERSION` |

Ports: API `5757`, Vite `5759`. Env prefix `LEDGER_`. Timezone `Europe/Zurich`.

## Rooms

| Route | What it shows |
| --- | --- |
| `/linie` | Station lanes, takt-by-hour, yield, span, defect mix |
| `/band` | Inspection and line-event tape |
| `/zelle/:dmc` | Cell dossier, open Akte |
| `/schicht` | Latest civil day with inspections |
| `/pin` | DuckLake snapshots and time travel |
| `/akte/:id` | Pin a snapshot, scrap disposition |

## Hardware

Arch Linux, Debian/Ubuntu, or macOS. Node 22 and PostgreSQL 16.

```bash
chmod +x bin/setup.sh bin/dev.sh
bin/setup.sh
bin/dev.sh --seed 2026-08-24
```

Open `http://127.0.0.1:5759`.

Manual equivalent:

```bash
cp .env.example .env
npm install
npm test
LEDGER_PG_URL=postgres://ledger:ledger@127.0.0.1:5432/ledger \
  LEDGER_LAKE_PATH=./data/lake \
  npm run seed -- 2026-08-24
LEDGER_PG_URL=postgres://ledger:ledger@127.0.0.1:5432/ledger \
  LEDGER_LAKE_PATH=./data/lake \
  LEDGER_INGEST_TOKEN=dev-ingest \
  LEDGER_OPERATOR_TOKEN=dev-operator \
  npm run dev:api
npm run dev:web
```

Seed rows are labeled `source=seed`. They are not live VALTR.

Ingest is fail-closed without `LEDGER_INGEST_TOKEN`. Lakehouse read failures
return `LAKEHOUSE_READ_UNAVAILABLE` and HTTP 503.

## What this is not

Not Cosmograph, not Parachute, not the QG Werkbank, not ports 4747–4749.
