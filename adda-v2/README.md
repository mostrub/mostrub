# Adda Ledger

Adda Ledger is version two of Adda. It is a new product in this repository.
It does not replace or take over [`mostrub/ADDA`](https://github.com/mostrub/ADDA).

The live HLL-2 stack on the Mac Studio stays where it is. Ledger is a
case-first forensic bench: Postgres holds cases and the DuckLake catalog,
DuckLake holds inspections, and DuckDB is the only engine that writes or
time-travels the lake.

## Stack

| Store | Role |
| --- | --- |
| PostgreSQL | `control` schema plus DuckLake catalog |
| DuckLake | `inspections`, `measurements`, `findings`, `line_events` |
| DuckDB | Attach `ducklake:postgres:…`, analytics, `SNAPSHOT_VERSION` |

Ports: API `5757`, Vite `5759`. Env prefix `LEDGER_`.

## Run locally

PostgreSQL 16 with databases `ledger` and `ledger_test`, user `ledger`.

```bash
cd adda-v2
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

Open `http://127.0.0.1:5759`. Rooms: Akten, Zelle, Chronik, Bank, See, Schicht.

Seed rows are labeled `source=seed`. They are not live VALTR.

## What this is not

Not Cosmograph, not Parachute, not the QG Werkbank, not ports 4747–4749.
Those belong to Adda v1.
