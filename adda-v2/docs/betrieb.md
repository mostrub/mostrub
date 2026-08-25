# Betrieb

Kaliber läuft auf der Box in der Halle. Nicht in der Cloud.

## Start

```bash
bin/setup.sh
bin/dev.sh --seed 2026-08-24
```

`bin/setup.sh` holt Node 22 und PostgreSQL 16, legt Rolle `ledger` an und die
Datenbanken `ledger` und `ledger_test`. Fehlt `.env`, kopiert das Skript
`.env.example`.

Ohne Seed:

```bash
bin/dev.sh
```

API: `http://127.0.0.1:5757`. Kaliber: `http://127.0.0.1:5759`. Vom Band aus
die LAN-Adresse, die `bin/dev.sh` druckt.

## Tokens

| Variable | Zweck |
| --- | --- |
| `LEDGER_INGEST_TOKEN` | Schreiben ins Lake. Leer heisst zu. |
| `LEDGER_OPERATOR_TOKEN` | Akte öffnen, pinnen, entscheiden. |
| `VITE_LEDGER_OPERATOR_TOKEN` | Gleicher Wert für den Browser. Vite nimmt `LEDGER_OPERATOR_TOKEN`. |

Ingest und Mutationen gehen mit `Authorization: Bearer …`. Ohne Token kommt
`INGEST_FORBIDDEN` und HTTP 401.

## Lake

`LEDGER_LAKE_PATH` ist der Parquet-Pfad. Er muss zum `DATA_PATH` im
Postgres-Katalog passen. Vom Repo-Root:

```bash
LEDGER_LAKE_PATH=./data/lake
```

Ein anderer Arbeitsordner (etwa `apps/api`) legt einen zweiten Pfad an. Dann
lehnt DuckLake den Attach ab.

Lesefehler: `LAKEHOUSE_READ_UNAVAILABLE`, HTTP 503. Kaliber zeigt
«Lakehouse nicht erreichbar.»

## Schichtbericht

Prüfung Schicht. Tag vor/zurück über die Tage im Lake. Berichtart wählen
(Voll, Stunden, Stationen, Klassen, NIO, Akten), dann «Bericht drucken».
«NIO-Liste kopieren» legt DMC, Klasse und Zeit in die Zwischenablage.
Lünette, Takt, Band und Kupon bleiben vom Papier weg.

`GET /api/schicht?tag=2026-08-24` und `GET /api/schicht/tage`.

## Seed

```bash
npm run seed -- 2026-08-24
```

72 Inspektionen, 72 Linienereignisse, alle 11 Klassen. `source=seed`. Nicht
als VALTR ausgeben. Kaliber schreibt die Quelle auf die Lünette.
