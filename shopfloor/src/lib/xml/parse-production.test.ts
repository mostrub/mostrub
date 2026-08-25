import { describe, expect, it } from "vitest"

import { parseProductionXml, productionFileId } from "./parse-production"

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ShopfloorExport plant="AUSTIN" generatedAt="2026-08-25T06:00:00Z"
  sourceShare="\\\\mes-aus-01\\production\\xml" shift="A" shiftDate="2026-08-25">
  <Cycle id="CYC-1" line="ASM-1" station="ST-04" machine="WELD-04"
    controller="PLC-WELD-04" workOrder="WO-1" sku="BRK-440" serial="SN-1"
    operator="OP-17" startedAt="2026-08-25T06:01:00Z" endedAt="2026-08-25T06:01:12Z"
    cycleMs="12000" targetCycleMs="11000" result="FAIL" goodQty="0" scrapQty="1"
    reworkQty="0" failCode="E12" failReason="weld porosity"/>
  <Downtime id="DT-1" line="ASM-1" station="ST-04" machine="WELD-04"
    controller="PLC-WELD-04" startedAt="2026-08-25T06:10:00Z"
    endedAt="2026-08-25T06:18:00Z" durationMs="480000" reasonCode="E-STOP"
    reasonText="operator e-stop" category="UNPLANNED" shift="A"/>
  <Alarm id="AL-1" line="ASM-1" station="ST-04" machine="WELD-04"
    controller="PLC-WELD-04" raisedAt="2026-08-25T06:10:01Z"
    clearedAt="2026-08-25T06:12:00Z" severity="CRITICAL" code="E401"
    message="estop circuit open" ackState="ACKED"/>
  <ServerSample id="SS-1" line="ASM-1" serverId="SRV-MES-01" role="MES"
    sampledAt="2026-08-25T06:05:00Z" cpuPct="81.2" memPct="64" diskPct="40"
    plcScanMs="12.4" heartbeatMs="90" queueDepth="7" missedHeartbeats="2"
    sessionCount="18" networkErr="1" temperatureC="47"/>
  <Controller id="PLC-WELD-04" line="ASM-1" station="ST-04" machine="WELD-04"
    vendor="Siemens" model="S7-1516" firmware="V3.1" ip="10.12.4.20"
    rack="0" slot="1" scanMsAvg="9.2" scanMsP95="14.1" ioFaults="3"
    lastFaultCode="E401" lastSeen="2026-08-25T06:18:00Z" runMode="RUN"/>
</ShopfloorExport>`

describe("parseProductionXml", () => {
  it("reads file metadata and every production record type", () => {
    const batch = parseProductionXml({
      fileName: "austin-shift-a.xml",
      xml: SAMPLE,
      byteSize: SAMPLE.length,
    })

    expect(batch.file.plant).toBe("AUSTIN")
    expect(batch.file.source_share).toBe("\\\\mes-aus-01\\production\\xml")
    expect(batch.file.shift).toBe("A")
    expect(batch.file.status).toBe("ok")
    expect(batch.file.cycle_count).toBe(1)
    expect(batch.cycles[0]?.result).toBe("FAIL")
    expect(batch.cycles[0]?.fail_code).toBe("E12")
    expect(batch.downtime[0]?.category).toBe("UNPLANNED")
    expect(batch.downtime[0]?.duration_ms).toBe(480000)
    expect(batch.alarms[0]?.severity).toBe("CRITICAL")
    expect(batch.server_samples[0]?.server_role).toBe("MES")
    expect(batch.server_samples[0]?.missed_heartbeats).toBe(2)
    expect(batch.controllers[0]?.vendor).toBe("Siemens")
    expect(batch.controllers[0]?.run_mode).toBe("RUN")
  })

  it("accepts snake_case attributes used by some MES drops", () => {
    const xml = `<ShopfloorExport plant="DALLAS">
      <Cycle cycle_id="C2" line="PACK-1" result="PASS" cycle_ms="8000"
        started_at="2026-08-25T07:00:00Z" ended_at="2026-08-25T07:00:08Z"/>
    </ShopfloorExport>`

    const batch = parseProductionXml({
      fileName: "dallas.xml",
      xml,
      byteSize: xml.length,
    })

    expect(batch.cycles).toHaveLength(1)
    expect(batch.cycles[0]?.cycle_id).toBe("C2")
    expect(batch.cycles[0]?.cycle_ms).toBe(8000)
    expect(batch.cycles[0]?.plant).toBe("DALLAS")
  })

  it("keeps the same file_id when the share file grows", () => {
    const first = parseProductionXml({
      fileName: "austin-shift-a.xml",
      xml: SAMPLE,
      byteSize: SAMPLE.length,
    })
    const grown = parseProductionXml({
      fileName: "austin-shift-a.xml",
      xml: `${SAMPLE}\n`,
      byteSize: SAMPLE.length + 20_000,
    })
    expect(first.file.file_id).toBe(grown.file.file_id)
    expect(first.file.file_id).toBe(
      productionFileId({
        fileName: "austin-shift-a.xml",
        plant: "AUSTIN",
        shift: "A",
        shiftDate: "2026-08-25",
      })
    )
  })

  it("marks empty xml as an error file with no rows", () => {
    const batch = parseProductionXml({
      fileName: "empty.xml",
      xml: "   ",
      byteSize: 0,
    })

    expect(batch.file.status).toBe("error")
    expect(batch.cycles).toHaveLength(0)
  })
})
