import {
  isAlarmSeverity,
  isCycleResult,
  isDowntimeCategory,
  isRunMode,
  isServerRole,
  type AlarmRow,
  type ControllerRow,
  type CycleRow,
  type DowntimeRow,
  type IngestFileRow,
  type ProductionBatch,
  type ServerSampleRow,
} from "@/lib/types"
import {
  attr,
  attrFloat,
  attrInt,
  collectElements,
  fnv1a,
  parseRootAttributes,
} from "@/lib/xml/attrs"

export function productionFileId(args: {
  fileName: string
  plant?: string
  shift?: string
  shiftDate?: string
}): string {
  const base = args.fileName.split(/[/\\]/).pop() ?? args.fileName
  const key = [args.plant ?? "", args.shiftDate ?? "", args.shift ?? "", base]
    .map((part) => part.trim().toLowerCase())
    .join("|")
  return `file-${fnv1a(key)}`
}

type ParseArgs = {
  fileName: string
  xml: string
  byteSize: number
  ingestedAt?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeResult(value: string): CycleRow["result"] {
  const upper = value.toUpperCase()
  if (isCycleResult(upper)) {
    return upper
  }
  if (upper === "OK" || upper === "GOOD") {
    return "PASS"
  }
  if (upper === "NG" || upper === "NOK" || upper === "SCRAP") {
    return "FAIL"
  }
  return "PASS"
}

function normalizeSeverity(value: string): AlarmRow["severity"] {
  const upper = value.toUpperCase()
  if (isAlarmSeverity(upper)) {
    return upper
  }
  if (upper === "ERROR" || upper === "FATAL" || upper === "HIGH") {
    return "CRITICAL"
  }
  if (upper === "WARNING") {
    return "WARN"
  }
  return "INFO"
}

function normalizeCategory(value: string): DowntimeRow["category"] {
  const upper = value.toUpperCase()
  if (isDowntimeCategory(upper)) {
    return upper
  }
  if (upper.includes("CHANGE")) {
    return "CHANGEOVER"
  }
  if (upper.includes("PLAN")) {
    return "PLANNED"
  }
  return "UNPLANNED"
}

function normalizeRole(value: string): ServerSampleRow["server_role"] {
  const upper = value.toUpperCase().replace(/\s+/g, "-")
  if (isServerRole(upper)) {
    return upper
  }
  if (upper.includes("HMI")) {
    return "HMI"
  }
  if (upper.includes("PLC")) {
    return "PLC-GATEWAY"
  }
  if (upper.includes("HIST")) {
    return "HISTORIAN"
  }
  if (upper.includes("SCADA")) {
    return "SCADA"
  }
  return "MES"
}

function normalizeMode(value: string): ControllerRow["run_mode"] {
  const upper = value.toUpperCase()
  if (isRunMode(upper)) {
    return upper
  }
  return "RUN"
}

export function parseProductionXml(args: ParseArgs): ProductionBatch {
  const ingestedAt = args.ingestedAt ?? nowIso()

  if (args.xml.trim() === "") {
    return {
      file: emptyFile({
        fileId: productionFileId({ fileName: args.fileName }),
        fileName: args.fileName,
        byteSize: args.byteSize,
        ingestedAt,
        error: "File is empty",
      }),
      cycles: [],
      downtime: [],
      alarms: [],
      server_samples: [],
      controllers: [],
    }
  }

  const root = parseRootAttributes(args.xml)
  const plant = attr(root, "plant", "Plant", "site")
  const shift = attr(root, "shift", "Shift")
  const shiftDate = attr(root, "shiftDate", "shift_date", "date")
  const fileId = productionFileId({
    fileName: args.fileName,
    plant,
    shift,
    shiftDate,
  })
  const sourceShare = attr(
    root,
    "sourceShare",
    "source_share",
    "share",
    "path"
  )

  const cycles = collectElements(args.xml, "Cycle").map((row, index) =>
    toCycle({
      attrs: row,
      fileId,
      plant,
      shift,
      index,
    })
  )
  const downtime = collectElements(args.xml, "Downtime").map((row, index) =>
    toDowntime({
      attrs: row,
      fileId,
      plant,
      shift,
      index,
    })
  )
  const alarms = collectElements(args.xml, "Alarm").map((row, index) =>
    toAlarm({
      attrs: row,
      fileId,
      plant,
      index,
    })
  )
  const server_samples = collectElements(args.xml, "ServerSample").map(
    (row, index) =>
      toServerSample({
        attrs: row,
        fileId,
        plant,
        index,
      })
  )
  const controllers = collectElements(args.xml, "Controller").map(
    (row, index) =>
      toController({
        attrs: row,
        fileId,
        plant,
        index,
      })
  )

  const file: IngestFileRow = {
    file_id: fileId,
    file_name: args.fileName,
    source_share: sourceShare,
    plant,
    shift,
    shift_date: shiftDate,
    ingested_at: ingestedAt,
    byte_size: args.byteSize,
    cycle_count: cycles.length,
    downtime_count: downtime.length,
    alarm_count: alarms.length,
    server_sample_count: server_samples.length,
    controller_count: controllers.length,
    status: "ok",
    error_message: "",
  }

  return { file, cycles, downtime, alarms, server_samples, controllers }
}

function emptyFile(args: {
  fileId: string
  fileName: string
  byteSize: number
  ingestedAt: string
  error: string
}): IngestFileRow {
  return {
    file_id: args.fileId,
    file_name: args.fileName,
    source_share: "",
    plant: "",
    shift: "",
    shift_date: "",
    ingested_at: args.ingestedAt,
    byte_size: args.byteSize,
    cycle_count: 0,
    downtime_count: 0,
    alarm_count: 0,
    server_sample_count: 0,
    controller_count: 0,
    status: "error",
    error_message: args.error,
  }
}

function toCycle(args: {
  attrs: Record<string, string>
  fileId: string
  plant: string
  shift: string
  index: number
}): CycleRow {
  const { attrs, fileId, index } = args
  return {
    cycle_id:
      attr(attrs, "id", "cycle_id", "cycleId") || `${fileId}-cyc-${index}`,
    file_id: fileId,
    plant: attr(attrs, "plant") || args.plant,
    line: attr(attrs, "line"),
    station: attr(attrs, "station"),
    machine: attr(attrs, "machine"),
    controller_id: attr(attrs, "controller", "controller_id", "controllerId"),
    work_order: attr(attrs, "workOrder", "work_order"),
    sku: attr(attrs, "sku"),
    serial: attr(attrs, "serial"),
    shift: attr(attrs, "shift") || args.shift,
    operator_id: attr(attrs, "operator", "operator_id", "operatorId"),
    started_at: attr(attrs, "startedAt", "started_at"),
    ended_at: attr(attrs, "endedAt", "ended_at"),
    cycle_ms: attrInt(attrs, 0, "cycleMs", "cycle_ms"),
    target_cycle_ms: attrInt(attrs, 0, "targetCycleMs", "target_cycle_ms"),
    result: normalizeResult(attr(attrs, "result")),
    good_qty: attrInt(attrs, 0, "goodQty", "good_qty"),
    scrap_qty: attrInt(attrs, 0, "scrapQty", "scrap_qty"),
    rework_qty: attrInt(attrs, 0, "reworkQty", "rework_qty"),
    fail_code: attr(attrs, "failCode", "fail_code"),
    fail_reason: attr(attrs, "failReason", "fail_reason"),
  }
}

function toDowntime(args: {
  attrs: Record<string, string>
  fileId: string
  plant: string
  shift: string
  index: number
}): DowntimeRow {
  const { attrs, fileId, index } = args
  return {
    event_id:
      attr(attrs, "id", "event_id", "eventId") || `${fileId}-dt-${index}`,
    file_id: fileId,
    plant: attr(attrs, "plant") || args.plant,
    line: attr(attrs, "line"),
    station: attr(attrs, "station"),
    machine: attr(attrs, "machine"),
    controller_id: attr(attrs, "controller", "controller_id", "controllerId"),
    started_at: attr(attrs, "startedAt", "started_at"),
    ended_at: attr(attrs, "endedAt", "ended_at"),
    duration_ms: attrInt(attrs, 0, "durationMs", "duration_ms"),
    reason_code: attr(attrs, "reasonCode", "reason_code"),
    reason_text: attr(attrs, "reasonText", "reason_text"),
    category: normalizeCategory(attr(attrs, "category")),
    shift: attr(attrs, "shift") || args.shift,
  }
}

function toAlarm(args: {
  attrs: Record<string, string>
  fileId: string
  plant: string
  index: number
}): AlarmRow {
  const { attrs, fileId, index } = args
  return {
    alarm_id:
      attr(attrs, "id", "alarm_id", "alarmId") || `${fileId}-al-${index}`,
    file_id: fileId,
    plant: attr(attrs, "plant") || args.plant,
    line: attr(attrs, "line"),
    station: attr(attrs, "station"),
    machine: attr(attrs, "machine"),
    controller_id: attr(attrs, "controller", "controller_id", "controllerId"),
    raised_at: attr(attrs, "raisedAt", "raised_at"),
    cleared_at: attr(attrs, "clearedAt", "cleared_at"),
    severity: normalizeSeverity(attr(attrs, "severity")),
    code: attr(attrs, "code"),
    message: attr(attrs, "message"),
    ack_state: attr(attrs, "ackState", "ack_state"),
  }
}

function toServerSample(args: {
  attrs: Record<string, string>
  fileId: string
  plant: string
  index: number
}): ServerSampleRow {
  const { attrs, fileId, index } = args
  return {
    sample_id:
      attr(attrs, "id", "sample_id", "sampleId") || `${fileId}-ss-${index}`,
    file_id: fileId,
    plant: attr(attrs, "plant") || args.plant,
    line: attr(attrs, "line"),
    server_id: attr(attrs, "serverId", "server_id"),
    server_role: normalizeRole(attr(attrs, "role", "serverRole", "server_role")),
    sampled_at: attr(attrs, "sampledAt", "sampled_at"),
    cpu_pct: attrFloat(attrs, 0, "cpuPct", "cpu_pct"),
    mem_pct: attrFloat(attrs, 0, "memPct", "mem_pct"),
    disk_pct: attrFloat(attrs, 0, "diskPct", "disk_pct"),
    plc_scan_ms: attrFloat(attrs, 0, "plcScanMs", "plc_scan_ms"),
    heartbeat_ms: attrFloat(attrs, 0, "heartbeatMs", "heartbeat_ms"),
    queue_depth: attrInt(attrs, 0, "queueDepth", "queue_depth"),
    missed_heartbeats: attrInt(
      attrs,
      0,
      "missedHeartbeats",
      "missed_heartbeats"
    ),
    session_count: attrInt(attrs, 0, "sessionCount", "session_count"),
    network_err: attrInt(attrs, 0, "networkErr", "network_err"),
    temperature_c: attrFloat(attrs, 0, "temperatureC", "temperature_c"),
  }
}

function toController(args: {
  attrs: Record<string, string>
  fileId: string
  plant: string
  index: number
}): ControllerRow {
  const { attrs, fileId, index } = args
  return {
    controller_id:
      attr(attrs, "id", "controller_id", "controllerId") ||
      `${fileId}-ctl-${index}`,
    file_id: fileId,
    plant: attr(attrs, "plant") || args.plant,
    line: attr(attrs, "line"),
    station: attr(attrs, "station"),
    machine: attr(attrs, "machine"),
    vendor: attr(attrs, "vendor"),
    model: attr(attrs, "model"),
    firmware: attr(attrs, "firmware"),
    ip_address: attr(attrs, "ip", "ip_address", "ipAddress"),
    rack: attrInt(attrs, 0, "rack"),
    slot: attrInt(attrs, 0, "slot"),
    scan_ms_avg: attrFloat(attrs, 0, "scanMsAvg", "scan_ms_avg"),
    scan_ms_p95: attrFloat(attrs, 0, "scanMsP95", "scan_ms_p95"),
    io_faults: attrInt(attrs, 0, "ioFaults", "io_faults"),
    last_fault_code: attr(attrs, "lastFaultCode", "last_fault_code"),
    last_seen: attr(attrs, "lastSeen", "last_seen"),
    run_mode: normalizeMode(attr(attrs, "runMode", "run_mode")),
  }
}
