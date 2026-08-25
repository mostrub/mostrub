# Kaliber

Ein Chassis. Sieben Prüfungen. Kein ADDA.

Die aktive Prüfung steht in `?sicht=`. Eine Zelle wählen ändert den Pfad auf
`/zelle/<dmc>`, die Prüfung bleibt.

## Prüfungen

| Prüfung | Was sie prüft |
| --- | --- |
| Maschine | Anode, Kathode, OQC. Standard: alle NIO der Station. Umschalter «Zuletzt» zeigt die letzten Ticks. |
| Tablett | Magazine T-1, T-2, T-3. Immer 12 Fächer in einer Reihe. |
| Fach | Dieselbe Lage über alle Magazine. Eine heisse Lage ist Prozess, nicht eine Zelle. |
| Fenster | Spanfenster min/p50/p95/max, Histogramm, Grenze 0,12 mm, jede Zelle darüber. |
| Klasse | Elf Klassen über 24 Zurich-Stunden. Antippen einer Stunde öffnet eine Zelle. |
| Schicht | Ziviler Tag: IO/NIO, Ausbeute, Stunden, Stationen, Span, Klassen, offene Akten, alle NIO. Druckbar. |
| Zeitreise | Film der Lake-Snapshots. Der Kupon zeigt nur den gewählten Stand. Fehlt der Stand: «kein Stand», kein Rückfall auf live. |

Takt oben: 24 Stunden Europe/Zurich. Band unten: letzte DMCs, NIO magenta.

## Kupon

Rechts. DMC als Ticket, nicht als LCD. Neueste Inspektion zuerst. Fach, Span,
Befunde, Historie.

| Aktion | Wirkung |
| --- | --- |
| Suchen | DMC auf der Lünette. Treffer oder Rohtext öffnet die Zelle. |
| Akte öffnen | Neue Akte auf der aktuellen Zelle. |
| Stand pinnen | Aktueller Lake-Snap an die offene Akte. |
| Halten | Disposition `hold`. |
| Freigeben | Disposition `release`, schliesst. |
| Ausschuss | Disposition `scrap`, schliesst. |
| Zurück auf Linie | Disposition `needs_line`. |

Die Akte bleibt auf dem Kupon. Kein Sprung nach `/akte`.

## Herkunft

Fusszeile: Lake-Store, Query, Snap, Zurich-Uhr. Seed-Wasserzeichen, wenn jede
Zelle `source=seed` trägt.
