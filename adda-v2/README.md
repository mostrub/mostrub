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

Ports: API `5757`, Vite `5759`. Bind `0.0.0.0` by default. Env prefix `LEDGER_`.
Timezone `Europe/Zurich`.

## Kaliber

One instrument. No rooms, no ADDA chrome.

Seven Prüfungen on the same chassis (`?sicht=`):

| Prüfung | Audit |
| --- | --- |
| Maschine | Anode → Kathode → OQC, NIO first |
| Tablett | 12-slot magazines |
| Fach | Same slot across all magazines |
| Fenster | Span histogram, p50/p95, over-limit cells |
| Klasse | 11 defect classes × 24 Zurich hours |
| Schicht | Civil-day IO/NIO, yield, class list |
| Zeitreise | Lake snapshots on the selected cell |

Takt (24 h, Europe/Zurich) and the cell coupon stay on the bezel. Opening a
cell does not leave the floor.

## Run on the box

Arch Linux, Debian/Ubuntu, or macOS. Node 22 and PostgreSQL 16. `bin/setup.sh`
installs both when the package manager is `pacman`, `apt-get`, or Homebrew.

```bash
git clone https://github.com/mostrub/ADDA-light.git
cd ADDA-light
chmod +x bin/setup.sh bin/dev.sh
bin/setup.sh
bin/dev.sh --seed 2026-08-24
```

Open `http://127.0.0.1:5759` on the box, or `http://<box-ip>:5759` from the hall.
`bin/dev.sh` prints LAN addresses.

Case writes need `Authorization: Bearer $LEDGER_OPERATOR_TOKEN`. The Vite
dev server injects that token from the env. Ingest is fail-closed without
`LEDGER_INGEST_TOKEN`. Lakehouse read failures return
`LAKEHOUSE_READ_UNAVAILABLE` and HTTP 503. The line board is the latest
Zurich civil day, not the whole lake.

```bash
cp .env.example .env
npm install
npm test
LEDGER_PG_URL=postgres://ledger:ledger@127.0.0.1:5432/ledger \
  LEDGER_LAKE_PATH=./data/lake \
  npm run seed -- 2026-08-24
LEDGER_PG_URL=postgres://ledger:ledger@127.0.0.1:5432/ledger \
  LEDGER_LAKE_PATH=./data/lake \
  LEDGER_API_HOST=0.0.0.0 \
  LEDGER_INGEST_TOKEN=dev-ingest \
  LEDGER_OPERATOR_TOKEN=dev-operator \
  npm run dev:api
npm run dev:web
```

Seed rows are labeled `source=seed`. They are not live VALTR.

## What this is not

Not Cosmograph, not Parachute, not the QG Werkbank, not ports 4747–4749.
