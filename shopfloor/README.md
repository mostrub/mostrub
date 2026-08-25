# Floorline

Local-first shopfloor production viewer. It runs in the browser, parses MES XML from a Windows share drop, and uses DuckDB-WASM for filtering, charts, reports, and Parquet/CSV export.

Native DuckDB on Windows is not required. The same engine runs inside the page.

## Run on Windows

```powershell
cd shopfloor
npm install
npm run dev
```

Open the printed localhost URL. Mapped drives and UNC shares work through the file picker (`Z:\production\xml` or `\\mes-aus-01\production\xml`). Select multiple `.xml` files, or click **Load demo production share**.

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

- Ingest — multi-file XML from a share
- Dashboard — units, FPY, pace, downtime, alarms, charts
- Drill and triage — plant → line → station → machine → controller
- Servers — MES/HMI/gateway/historian profiles and PLC controllers
- Explorer — DuckDB table scan, sort, page
- Reports — auto shift / loss / server reports
- Export — CSV, Parquet, share URL, filter card

Filters live in the left rail and in the URL hash so a view can be sent to someone else on the same machine.

## Scripts

```powershell
npm test
npm run typecheck
npm run build
```
