# Floorline

Local-first shopfloor production viewer. It runs in the browser, parses MES XML from a Windows share drop, and uses DuckDB-WASM for filtering, charts, reports, and Parquet/CSV export.

Native DuckDB on Windows is not required. The same engine runs inside the page.

## One-time install

**Windows 11:** double-click `install-windows.cmd`, or:

```powershell
cd shopfloor
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
```

That installs Node.js LTS with winget if it is missing, runs `npm install`, puts **Floorline** and **Stop Floorline** on the Desktop, and opens the app full screen. If winget is unavailable, install Node.js LTS from https://nodejs.org and re-run the script.

**macOS:** double-click `install-macos.command`, or:

```bash
cd shopfloor
chmod +x install-macos.sh
./install-macos.sh
```

That installs Homebrew and Node.js if they are missing, runs `npm install`, and puts **Floorline** and **Stop Floorline** on the Desktop (including localized Desktop folders). If macOS blocks a `.command` file: right-click → Open.

After that, people on the floor only need the Desktop icons. **Floorline** starts the server and opens Edge or Chrome full screen. **Stop Floorline** quits it. The header also has **Full screen**.

Light, Dark, and System live in the header. The `d` key still flips light and dark when focus is not in an input.

## Share on the shopfloor LAN

The installer and Desktop launcher bind all network interfaces. Other Windows, macOS, and Linux machines on the same LAN open Floorline in a browser — use **Share** in the header and copy a `http://<this-pc>:5173/` address. Production data stays on the host PC.

Manual equivalent (this PC only, or LAN if you keep the default Vite host):

```powershell
cd shopfloor
npm install
npm run dev
```

Mapped drives and UNC shares work through the file picker (`Z:\production\xml` or `\\mes-aus-01\production\xml`). Select multiple `.xml` files, or click **Load demo production share**.

`npm run build` then `npm run preview` is the offline bundle.

## XML shape

```xml
<ShopfloorExport plant="AUSTIN" sourceShare="\\mes-aus-01\production\xml" shift="A" shiftDate="2026-08-25">
  <Cycle id="CYC-1" line="ASM-1" station="ST-04" machine="WELD-04"
    controller="PLC-WELD-04" workOrder="WO-1" sku="BRK-440" serial="SN-1"
    operator="OP-17" startedAt="2026-08-25T06:01:00Z" endedAt="2026-08-25T06:01:12Z"
    cycleMs="12000" targetCycleMs="11000" result="PASS" goodQty="1" scrapQty="0" reworkQty="0"/>
  <Downtime id="DT-1" line="ASM-1" durationMs="480000" reasonCode="E-STOP" category="UNPLANNED"/>
  <Alarm id="AL-1" severity="CRITICAL" code="E401" message="estop circuit open"/>
  <ServerSample serverId="SRV-AUS-ASM-1-MES" role="MES" cpuPct="42" plcScanMs="9.1"/>
  <Controller id="PLC-WELD-04" vendor="Siemens" scanMsP95="14.1" runMode="RUN"/>
</ShopfloorExport>
```

camelCase and snake_case attributes both parse.

## Views

- Ingest — XML folder/share drop, plus CSV/Parquet round-trip
- Dashboard — OEE (A/P/Q), units, FPY, cycle histogram, shift × line
- Drill and triage — plant → line → station → machine → controller
- Servers — MES/HMI/gateway/historian profiles and PLC controllers
- Explorer — table scan plus a read-only SQL console
- Reports — auto shift / loss / server reports, print
- Export — CSV, Parquet, share URL, filter card
- Local snapshot — IndexedDB parquet so a refresh keeps the last ingest
- Filter presets and chips — save ASM-2 night, pin/clear from the header

Filters live in the left rail and in the URL hash so a view can be sent to someone else on the same machine.

## Scripts

```powershell
npm test
npm run typecheck
npm run build
```
