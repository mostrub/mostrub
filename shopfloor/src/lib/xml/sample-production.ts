import type { ProductionBatch } from "@/lib/types"
import { parseProductionXml } from "@/lib/xml/parse-production"

type Rng = () => number

function mulberry32(seed: number): Rng {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: Rng, values: readonly T[]): T {
  const index = Math.floor(rng() * values.length)
  const value = values[index]
  if (value === undefined) {
    throw new Error("empty pick")
  }
  return value
}

function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

type ShareFile = {
  fileName: string
  xml: string
}

const PLANTS = {
  austin: {
    plant: "AUSTIN",
    share: "\\\\mes-aus-01\\production\\xml\\2026-08-25",
    lines: [
      {
        line: "ASM-1",
        stations: ["ST-01", "ST-02", "ST-04"],
        skus: ["BRK-440", "BRK-441"],
        target: 11000,
        failRate: 0.04,
      },
      {
        line: "ASM-2",
        stations: ["ST-10", "ST-11"],
        skus: ["HSG-220"],
        target: 9000,
        failRate: 0.11,
      },
    ],
  },
  dallas: {
    plant: "DALLAS",
    share: "\\\\mes-dal-02\\production\\xml\\2026-08-25",
    lines: [
      {
        line: "PACK-1",
        stations: ["PK-01", "PK-02"],
        skus: ["KIT-90"],
        target: 6500,
        failRate: 0.03,
      },
    ],
  },
} as const

const FAIL_CODES = [
  { code: "E12", reason: "weld porosity" },
  { code: "E18", reason: "torque below min" },
  { code: "E22", reason: "vision mismatch" },
  { code: "E31", reason: "press force high" },
] as const

const DT_REASONS = [
  { code: "E-STOP", text: "operator e-stop", category: "UNPLANNED" },
  { code: "JAM", text: "conveyor jam", category: "UNPLANNED" },
  { code: "TOOL", text: "tool change", category: "PLANNED" },
  { code: "CO", text: "sku changeover", category: "CHANGEOVER" },
  { code: "STARVE", text: "upstream starve", category: "UNPLANNED" },
] as const

const ALARM_BANK = [
  { severity: "CRITICAL", code: "E401", message: "e-stop circuit open" },
  { severity: "WARN", code: "W210", message: "scan time drifting" },
  { severity: "WARN", code: "W088", message: "air pressure low" },
  { severity: "INFO", code: "I012", message: "batch complete" },
  { severity: "CRITICAL", code: "E512", message: "gateway heartbeat lost" },
] as const

function attrs(record: Record<string, string | number>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}="${xmlEscape(String(value))}"`)
    .join(" ")
}

export function buildShareSampleFiles(): ShareFile[] {
  const start = Date.parse("2026-08-24T22:00:00Z")
  return [
    buildPlantFile({
      fileName: "austin-asm-shift-a.xml",
      plantKey: "austin",
      shift: "A",
      seed: 4401,
      start,
      hours: 8,
      includeServers: true,
    }),
    buildPlantFile({
      fileName: "austin-asm-shift-b.xml",
      plantKey: "austin",
      shift: "B",
      seed: 4402,
      start: start + 8 * 3600_000,
      hours: 8,
      includeServers: true,
    }),
    buildPlantFile({
      fileName: "dallas-pack-shift-a.xml",
      plantKey: "dallas",
      shift: "A",
      seed: 7701,
      start,
      hours: 10,
      includeServers: true,
    }),
  ]
}

function buildPlantFile(args: {
  fileName: string
  plantKey: keyof typeof PLANTS
  shift: string
  seed: number
  start: number
  hours: number
  includeServers: boolean
}): ShareFile {
  const rng = mulberry32(args.seed)
  const plant = PLANTS[args.plantKey]
  const cycles: string[] = []
  const downtime: string[] = []
  const alarms: string[] = []
  const servers: string[] = []
  const controllers: string[] = []

  for (const line of plant.lines) {
    for (const station of line.stations) {
      const machine = `${line.line}-${station}`
      const controllerId = `PLC-${machine}`
      controllers.push(
        `<Controller ${attrs({
          id: controllerId,
          line: line.line,
          station,
          machine,
          vendor: pick(rng, ["Siemens", "Rockwell", "Beckhoff"]),
          model: pick(rng, ["S7-1516", "CompactLogix", "CX-2040"]),
          firmware: pick(rng, ["V3.1", "V32.11", "V4.0"]),
          ip: `10.${plant.plant === "AUSTIN" ? 12 : 18}.${10 + [...line.stations].indexOf(station)}.${20 + controllers.length}`,
          rack: 0,
          slot: 1,
          scanMsAvg: between(rng, 6, 14).toFixed(1),
          scanMsP95: between(rng, 12, line.line === "ASM-2" ? 28 : 18).toFixed(1),
          ioFaults: line.line === "ASM-2" ? Math.floor(between(rng, 1, 6)) : 0,
          lastFaultCode: line.line === "ASM-2" ? "E401" : "",
          lastSeen: iso(args.start + args.hours * 3600_000),
          runMode: line.line === "ASM-2" && rng() < 0.15 ? "FAULT" : "RUN",
        })}/>`
      )

      const cycleCount = 80 + Math.floor(rng() * 40)
      for (let i = 0; i < cycleCount; i += 1) {
        const started = args.start + Math.floor(rng() * args.hours * 3600_000)
        const over = rng() < (line.line === "ASM-2" ? 0.22 : 0.08)
        const cycleMs = Math.round(
          line.target * (over ? between(rng, 1.25, 1.7) : between(rng, 0.88, 1.08))
        )
        const fail = rng() < line.failRate
        const rework = !fail && rng() < 0.02
        const failInfo = fail ? pick(rng, FAIL_CODES) : { code: "", reason: "" }
        cycles.push(
          `<Cycle ${attrs({
            id: `CYC-${args.shift}-${machine}-${i}`,
            line: line.line,
            station,
            machine,
            controller: controllerId,
            workOrder: `WO-${44000 + Math.floor(rng() * 40)}`,
            sku: pick(rng, line.skus),
            serial: `SN-${plant.plant.slice(0, 3)}-${100000 + i + Math.floor(rng() * 50)}`,
            operator: `OP-${10 + Math.floor(rng() * 12)}`,
            startedAt: iso(started),
            endedAt: iso(started + cycleMs),
            cycleMs,
            targetCycleMs: line.target,
            result: fail ? "FAIL" : rework ? "REWORK" : "PASS",
            goodQty: fail ? 0 : 1,
            scrapQty: fail ? 1 : 0,
            reworkQty: rework ? 1 : 0,
            failCode: failInfo.code,
            failReason: failInfo.reason,
          })}/>`
        )
      }

      const dtCount = 4 + Math.floor(rng() * 5)
      for (let i = 0; i < dtCount; i += 1) {
        const reason = pick(rng, DT_REASONS)
        const started = args.start + Math.floor(rng() * args.hours * 3600_000)
        const duration = Math.round(between(rng, 2, reason.category === "CHANGEOVER" ? 28 : 16) * 60_000)
        downtime.push(
          `<Downtime ${attrs({
            id: `DT-${args.shift}-${machine}-${i}`,
            line: line.line,
            station,
            machine,
            controller: controllerId,
            startedAt: iso(started),
            endedAt: iso(started + duration),
            durationMs: duration,
            reasonCode: reason.code,
            reasonText: reason.text,
            category: reason.category,
            shift: args.shift,
          })}/>`
        )
      }

      const alarmCount = 6 + Math.floor(rng() * 8)
      for (let i = 0; i < alarmCount; i += 1) {
        const alarm = pick(rng, ALARM_BANK)
        const raised = args.start + Math.floor(rng() * args.hours * 3600_000)
        alarms.push(
          `<Alarm ${attrs({
            id: `AL-${args.shift}-${machine}-${i}`,
            line: line.line,
            station,
            machine,
            controller: controllerId,
            raisedAt: iso(raised),
            clearedAt: iso(raised + Math.round(between(rng, 30, 900) * 1000)),
            severity: alarm.severity,
            code: alarm.code,
            message: alarm.message,
            ackState: rng() < 0.7 ? "ACKED" : "OPEN",
          })}/>`
        )
      }
    }

    if (args.includeServers) {
      const roles = ["MES", "HMI", "PLC-GATEWAY", "HISTORIAN"] as const
      for (const role of roles) {
        const serverId = `SRV-${plant.plant.slice(0, 3)}-${line.line}-${role}`
        const hot = role === "PLC-GATEWAY" && line.line === "ASM-2"
        const samples = 36
        for (let i = 0; i < samples; i += 1) {
          const sampled = args.start + Math.floor((i / samples) * args.hours * 3600_000)
          servers.push(
            `<ServerSample ${attrs({
              id: `SS-${serverId}-${i}`,
              line: line.line,
              serverId,
              role,
              sampledAt: iso(sampled),
              cpuPct: between(rng, hot ? 70 : 18, hot ? 97 : 62).toFixed(1),
              memPct: between(rng, 40, hot ? 88 : 70).toFixed(1),
              diskPct: between(rng, 30, 55).toFixed(1),
              plcScanMs: between(rng, 6, hot ? 32 : 14).toFixed(1),
              heartbeatMs: between(rng, 40, hot ? 420 : 120).toFixed(0),
              queueDepth: Math.floor(between(rng, 0, hot ? 40 : 8)),
              missedHeartbeats: hot && rng() < 0.35 ? Math.floor(between(rng, 1, 6)) : 0,
              sessionCount: Math.floor(between(rng, 4, 28)),
              networkErr: hot && rng() < 0.25 ? 1 : 0,
              temperatureC: between(rng, 38, hot ? 72 : 52).toFixed(1),
            })}/>`
          )
        }
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ShopfloorExport plant="${plant.plant}" generatedAt="${iso(args.start + args.hours * 3600_000)}" sourceShare="${xmlEscape(plant.share)}" shift="${args.shift}" shiftDate="2026-08-25">
${cycles.join("\n")}
${downtime.join("\n")}
${alarms.join("\n")}
${servers.join("\n")}
${controllers.join("\n")}
</ShopfloorExport>
`
  return { fileName: args.fileName, xml }
}

export function parseShareSamples(): ProductionBatch[] {
  return buildShareSampleFiles().map((file) =>
    parseProductionXml({
      fileName: file.fileName,
      xml: file.xml,
      byteSize: file.xml.length,
      ingestedAt: "2026-08-25T10:00:00.000Z",
    })
  )
}

export function sampleFileBlobs(): File[] {
  return buildShareSampleFiles().map(
    (file) =>
      new File([file.xml], file.fileName, {
        type: "text/xml",
      })
  )
}
