# Daten

## Zelle

Schlüssel ist die DMC. Fehlt sie bei der Aufnahme, setzt der Kernel
`KEIN_DMC` plus UUID. Kaliber sucht über die ganze DMC oder den Schwanz.

## Fehlerklassen

Geschlossene Menge, elf Stück:

- Span
- Zink
- Kratzer
- Dichtungsbraue
- Abgeschabte_Dichtung
- Ausgezogene_Dichtung
- Elektrolyt_Flecken
- Nicht_geschlossen
- Paste
- Separator
- Verletzung_Becherrand

Andere Namen weist die Aufnahme ab.

## Datensee

DuckDB hängt so an:

```text
ATTACH 'ducklake:postgres:dbname=… host=127.0.0.1 user=ledger password=ledger'
  AS lake (DATA_PATH, METADATA_SCHEMA, READ_ONLY?, SNAPSHOT_VERSION?)
```

Nur DuckDB schreibt Parquet. Zeitreise geht über `SNAPSHOT_VERSION`. Ein
früher Stand ohne `findings` gibt `SNAPSHOT_CONFLICT` 409, nicht die
laufenden Befunde.

Das Linienboard (`/api/linie`) und der Schichtbericht (`/api/schicht`)
schneiden den letzten zivilen Tag Zürich, nicht den ganzen Datensee.

## Akten

Postgres, Schema `control`. Status `open`, `pinned`, `closed`. Pins halten
einen Stand. Dispositionen `hold`, `release`, `scrap`, `needs_line`.
`release` und `scrap` schliessen die Akte.

## Herkunft

Auswertungen tragen `_provenance`: Speicher `ducklake`, Abfragename,
Stand-Nummer. Kaliber schreibt das auf Deutsch in die Fusszeile.
