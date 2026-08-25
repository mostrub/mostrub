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

## Leitstand

One surface. No rooms.

The line is a set of physical trays. Each Fach is a cell. Takt is a 24-hour
rule. Span is a process window with p50/p95 and a 0,12 mm limit. Defect classes
and the Durchlauf sit on the same Blatt. Opening a cell keeps you on the floor.

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
