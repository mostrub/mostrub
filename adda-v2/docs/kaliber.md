# Kaliber

Ein Chassis. Sieben Prüfungen. Kein ADDA.

Die aktive Prüfung steht in `?sicht=`. Eine Zelle wählen ändert den Pfad auf
`/zelle/<dmc>`, die Prüfung bleibt. Weitere Optionen in der URL:

| Parameter | Wirkung |
| --- | --- |
| `tag=2026-08-24` | Schichtbericht dieses zivilen Tags |
| `bericht=stunden` | Nur Stunden, oder `maschine`, `klassen`, `nio`, `akten` |
| `nio=0` | Maschine zeigt letzte Ereignisse statt alle NIO |
| `klasse=Span` | Klasse filtert auf eine Fehlerklasse |
| `akten=pinned` | Aktenliste gepinnt, oder `alle` |

## Prüfungen

| Prüfung | Was sie prüft |
| --- | --- |
| Maschine | Anode, Kathode, OQC. Standard: alle NIO der Station. Umschalter «Zuletzt» zeigt die letzten Ereignisse. |
| Tablett | Magazine T-1, T-2, T-3. Immer 12 Fächer in einer Reihe. |
| Fach | Dieselbe Lage über alle Magazine. Eine heisse Lage ist Prozess, nicht eine Zelle. |
| Fenster | Spanfenster min/Median/P95/max, Histogramm, Grenze 0,12 mm, jede Zelle darüber. |
| Klasse | Elf Klassen über 24 Stunden Zürich. Antippen einer Stunde öffnet eine Zelle. |
| Schicht | Ziviler Tag mit Wahl. Berichte: Voll, Stunden, Stationen, Klassen, NIO, Akten. Druck und NIO-Liste. |
| Zeitreise | Film der Stände im Datensee. Der Kupon zeigt nur den gewählten Stand. Fehlt der Stand: «kein Stand», kein Rückfall auf den laufenden Stand. |

Zeitlinie oben: echte Ereignisse von der ersten Inspektion bis jetzt, kein
15-Minuten- oder Stundenraster. Band unten: letzte DMCs, NIO magenta.

## Kupon

Rechts. DMC als Ticket, nicht als LCD. Neueste Inspektion zuerst. Fach, Span,
Befunde, Historie.

| Aktion | Wirkung |
| --- | --- |
| Suchen | DMC auf der Lünette. Treffer oder Rohtext öffnet die Zelle. |
| Akte öffnen | Neue Akte auf der aktuellen Zelle. |
| Stand pinnen | Aktueller Stand im Datensee an die offene Akte. |
| Halten | Disposition `hold`. |
| Freigeben | Disposition `release`, schliesst. |
| Ausschuss | Disposition `scrap`, schliesst. |
| Zurück auf Linie | Disposition `needs_line`. |

Die Akte bleibt auf dem Kupon. Kein Sprung nach `/akte`.

## Herkunft

Fusszeile: Datensee, Speicher, Abfrage, Stand, Zürich-Uhr. Wasserzeichen
«Übungsdaten», wenn jede Zelle `source=seed` trägt.
