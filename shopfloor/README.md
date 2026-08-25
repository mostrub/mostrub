# Floorline

Lokaler Fertigungsviewer für die Shopfloor. Läuft im Browser, liest MES-XML aus einer Windows-Freigabe und nutzt DuckDB-WASM für Filter, Diagramme, Berichte und Parquet/CSV-Export.

Native DuckDB unter Windows ist nicht nötig. Dieselbe Engine läuft in der Seite.

## Einmalige Installation

**Windows 11:** `install-windows.cmd` doppelklicken, oder:

```powershell
cd shopfloor
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
```

Das installiert Node.js LTS mit winget, falls es fehlt, führt `npm install` aus, legt **Floorline** und **Floorline beenden** auf den Desktop und öffnet die App im Vollbild. Ohne winget Node.js LTS von https://nodejs.org installieren und das Skript erneut starten.

**macOS:** `install-macos.command` doppelklicken, oder:

```bash
cd shopfloor
chmod +x install-macos.sh
./install-macos.sh
```

Das installiert Homebrew und Node.js, falls sie fehlen, führt `npm install` aus und legt **Floorline** und **Floorline beenden** auf den Desktop, auch in lokalisierten Desktop-Ordnern. Wenn macOS eine `.command`-Datei blockiert: Rechtsklick, Öffnen.

Danach brauchen die Leute an der Linie nur zwei Desktop-Symbole und die Notiz **Floorline – Kurzanleitung**:

- **Floorline** startet die App im Vollbild. Kein schwarzes Fenster.
- **Floorline beenden** schließt sie und sagt das in einer kurzen Meldung.

Im Kopf gibt es zusätzlich **Vollbild**, falls jemand die Fensteransicht verlässt.

Hell, Dunkel und System stehen im Kopf. Die Taste `d` wechselt Hell und Dunkel, wenn der Fokus nicht in einem Eingabefeld liegt.

## Im Shopfloor-LAN teilen

Installer und Desktop-Starter binden alle Netzwerkschnittstellen. **Freigabe** im Kopf listet LAN-URLs, das Host-Betriebssystem und jeden Windows-, Mac- und Linux-Browser, der diese Instanz geöffnet hat. Die Beitrittsnachricht kopieren und an die anderen Rechner schicken. Die Produktionsdaten bleiben auf dem Host-Rechner.

Manuelles Äquivalent, nur dieser Rechner, oder LAN wenn der Vite-Host so bleibt:

```powershell
cd shopfloor
npm install
npm run dev
```

Gemappte Laufwerke und UNC-Freigaben funktionieren über den Dateidialog (`Z:\produktion\xml` oder `\\mes-aus-01\production\xml`). Mehrere `.xml`-Dateien wählen oder **Demo-Produktion laden** klicken.

DuckDB-Stände liegen als portable `.floorline`-Datei (Parquet-Pack) auf derselben Freigabe oder lokal. Unter Import **Stand-Ordner wählen**, dann **Auf Freigabe speichern**. Liegen mehrere Stände im Ordner, einen mit **Laden** öffnen. Edge und Chrome unter Windows schreiben direkt auf das gemappte Laufwerk. Andere Browser: **Datei herunterladen** und später **Stand-Datei laden**, oder die Datei auf Import ablegen. Ein Refresh behält den zuletzt geladenen Stand in IndexedDB.

`npm run build` und danach `npm run preview` ist das Offline-Paket.

## XML-Form

```xml
<ShopfloorExport plant="AUSTIN" sourceShare="\\mes-aus-01\production\xml" shift="A" shiftDate="2026-08-25">
  <Cycle id="CYC-1" line="CELL-1" station="ST-04" machine="CELL-1-ST-04"
    controller="PLC-CELL-1-ST-04" workOrder="WO-1" sku="CELL-2170" serial="SN-1"
    operator="OP-17" startedAt="2026-08-25T06:01:00Z" endedAt="2026-08-25T06:01:12Z"
    cycleMs="12000" targetCycleMs="11000" result="PASS" goodQty="1" scrapQty="0" reworkQty="0"/>
  <Downtime id="DT-1" line="CELL-1" durationMs="480000" reasonCode="STARVE" category="UNPLANNED"/>
  <Alarm id="AL-1" severity="CRITICAL" code="E401" message="Not-Halt-Kreis offen"/>
  <ServerSample serverId="SRV-AUS-CELL-1-MES" role="MES" cpuPct="42" plcScanMs="9.1"/>
  <Controller id="PLC-CELL-1-ST-04" vendor="Siemens" scanMsP95="14.1" runMode="RUN"/>
</ShopfloorExport>
```

camelCase- und snake_case-Attribute werden beide gelesen.

## Ansichten

- Import. XML-Ordner oder Freigabe, CSV/Parquet-Rundlauf, DuckDB-Stand (`.floorline`) auf die Freigabe oder als Datei
- Übersicht. OEE (V/L/Q), Stück, FPY, Takthistogramm, Schicht × Linie, Marge, abhängige Linien
- Drill und Triage. Werk → Linie → Station → Maschine → Steuerung
- OLAP. DuckDB-Würfel über den aktuellen Filter
- Preise. Katalog, Schichtlohn, Stückkosten, Marge
- Server. MES/HMI/Gateway/Historie und PLC-Steuerungen
- Tabellen. Tabellenscan plus schreibgeschützte SQL-Konsole
- Berichte. Automatische Schicht-, Verlust- und Serverberichte, Druck
- Export. CSV, Parquet, Freigabe-URL, Filterkarte
- Lokaler Stand. IndexedDB-Parquet, damit ein Refresh den letzten Import behält
- DuckDB-Stand. Eine `.floorline`-Datei für die Freigabe; mehrere Stände, einen davon laden
- Filtervorlagen und Chips. CELL-1 Nacht speichern, aus dem Kopf pinnen oder leeren

Filter leben in der linken Leiste und im URL-Hash, damit eine Ansicht an jemand anderen auf demselben Rechner geht.

## Skripte

```powershell
npm test
npm run typecheck
npm run build
```
