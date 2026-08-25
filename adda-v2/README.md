# ADDA light

Privates Produkt: [`mostrub/ADDA-light`](https://github.com/mostrub/ADDA-light).

ADDA light ist der lokale Boden für HLL-2. Postgres hält Akten und den
DuckLake-Katalog. DuckLake hält die Inspektionen. Nur DuckDB schreibt in den
Datensee und reist in der Zeit.

Das ersetzt [`mostrub/ADDA`](https://github.com/mostrub/ADDA) nicht.

Mehr in [docs/betrieb.md](docs/betrieb.md), [docs/kaliber.md](docs/kaliber.md)
und [docs/daten.md](docs/daten.md).

## Speicher

| Speicher | Aufgabe |
| --- | --- |
| PostgreSQL 16 | Schema `control` plus DuckLake-Katalog |
| DuckLake | `inspections`, `measurements`, `findings`, `line_events` |
| DuckDB | Anhängen `ducklake:postgres:…`, Auswertungen, `SNAPSHOT_VERSION` |

Ports: Schnittstelle `5757`, Oberfläche `5759`. Horcht standardmässig auf
`0.0.0.0`. Umgebungspräfix `LEDGER_`. Zeitzone Zürich (`Europe/Zurich`).

## Kaliber

Ein Instrument. Keine Räume, kein ADDA-Chrom. Die Oberfläche spricht nur
Deutsch (de-CH).

Sieben Prüfungen auf demselben Chassis (`?sicht=`):

| Prüfung | Blick |
| --- | --- |
| Maschine | Anode → Kathode → OQC, NIO zuerst |
| Tablett | Magazine mit 12 Fächern |
| Fach | Dieselbe Lage über alle Magazine |
| Fenster | Span-Histogramm, Median und 95-Perzentil, Zellen über der Grenze |
| Klasse | 11 Fehlerklassen × 24 Stunden Zürich |
| Schicht | Bericht mit Tagwahl und Arten (Voll, Stunden, Stationen, Klassen, NIO, Akten). Druck und NIO-Liste. |
| Zeitreise | Stände im Datensee der gewählten Zelle |

Takt (24 h, Zürich) und der Zellkupon bleiben am Instrument. Eine Zelle
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
`bin/dev.sh` schreibt die Hallenadressen.

Akten schreiben braucht `Authorization: Bearer $LEDGER_OPERATOR_TOKEN`. Der
Oberflächen-Entwicklungsserver legt das Token aus der Umgebung. Aufnahme ohne
`LEDGER_INGEST_TOKEN` bleibt zu. Lesefehler im Datensee kommen als
`LAKEHOUSE_READ_UNAVAILABLE` und HTTP 503. Das Linienboard ist der letzte
zivile Tag in Zürich, nicht der ganze Datensee.

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

`LEDGER_LAKE_PATH` vom Stammverzeichnis aus setzen. Relativ aus `apps/api`
zeigt der Datensee woanders hin als der Katalog.

Übungszeilen tragen `source=seed`. Das ist nicht laufendes VALTR.

## Was das nicht ist

Kein Cosmograph, kein Parachute, keine QG-Werkbank, keine Ports 4747–4749.
