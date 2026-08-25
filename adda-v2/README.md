# ADDA light

Privates Produkt: [`mostrub/ADDA-light`](https://github.com/mostrub/ADDA-light).

ADDA light ist der lokale Boden für HLL-2. Postgres hält Akten und den
DuckLake-Katalog. DuckLake hält die Inspektionen. Nur DuckDB schreibt in den
Lake und reist in der Zeit.

Das ersetzt [`mostrub/ADDA`](https://github.com/mostrub/ADDA) nicht.

Mehr in [docs/betrieb.md](docs/betrieb.md), [docs/kaliber.md](docs/kaliber.md)
und [docs/daten.md](docs/daten.md).

## Speicher

| Speicher | Aufgabe |
| --- | --- |
| PostgreSQL 16 | Schema `control` plus DuckLake-Katalog |
| DuckLake | `inspections`, `measurements`, `findings`, `line_events` |
| DuckDB | Attach `ducklake:postgres:…`, Auswertungen, `SNAPSHOT_VERSION` |

Ports: API `5757`, Vite `5759`. Bind standardmässig `0.0.0.0`. Env-Präfix
`LEDGER_`. Zeitzone `Europe/Zurich`.

## Kaliber

Ein Instrument. Keine Räume, kein ADDA-Chrom. Die Oberfläche spricht nur
Deutsch (de-CH).

Sieben Prüfungen auf demselben Chassis (`?sicht=`):

| Prüfung | Blick |
| --- | --- |
| Maschine | Anode → Kathode → OQC, NIO zuerst |
| Tablett | Magazine mit 12 Fächern |
| Fach | Dieselbe Lage über alle Magazine |
| Fenster | Span-Histogramm, p50/p95, Zellen über der Grenze |
| Klasse | 11 Fehlerklassen × 24 Zurich-Stunden |
| Schicht | Bericht des zivilen Tags. Druck blendet Takt, Band und Kupon aus. |
| Zeitreise | Lake-Snapshots der gewählten Zelle |

Takt (24 h, Europe/Zurich) und der Zellkupon bleiben am Instrument. Eine Zelle
öffnen verlässt den Boden nicht.

## Auf der Box

Arch Linux, Debian/Ubuntu oder macOS. Node 22 und PostgreSQL 16.
`bin/setup.sh` installiert beides, wenn der Paketmanager `pacman`, `apt-get`
oder Homebrew ist.

```bash
git clone https://github.com/mostrub/ADDA-light.git
cd ADDA-light
chmod +x bin/setup.sh bin/dev.sh
bin/setup.sh
bin/dev.sh --seed 2026-08-24
```

Auf der Box `http://127.0.0.1:5759`, in der Halle `http://<box-ip>:5759`.
`bin/dev.sh` schreibt die LAN-Adressen.

Akten schreiben braucht `Authorization: Bearer $LEDGER_OPERATOR_TOKEN`. Der
Vite-Devserver legt das Token aus der Umgebung. Ingest ohne
`LEDGER_INGEST_TOKEN` bleibt zu. Lake-Lesefehler kommen als
`LAKEHOUSE_READ_UNAVAILABLE` und HTTP 503. Das Linienboard ist der letzte
zivile Tag in Zurich, nicht der ganze Lake.

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

`LEDGER_LAKE_PATH` vom Repo-Root aus setzen. Relativ aus `apps/api` zeigt der
Lake woanders hin als der Katalog.

Seed-Zeilen tragen `source=seed`. Das ist nicht live VALTR.

## Was das nicht ist

Kein Cosmograph, kein Parachute, keine QG-Werkbank, keine Ports 4747–4749.
