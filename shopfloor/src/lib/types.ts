export const CYCLE_RESULTS = ["PASS", "FAIL", "REWORK"] as const
export type CycleResult = (typeof CYCLE_RESULTS)[number]

export const ALARM_SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number]

export const DOWNTIME_CATEGORIES = [
  "PLANNED",
  "UNPLANNED",
  "CHANGEOVER",
] as const
export type DowntimeCategory = (typeof DOWNTIME_CATEGORIES)[number]

export const SERVER_ROLES = [
  "MES",
  "HMI",
  "PLC-GATEWAY",
  "HISTORIAN",
  "SCADA",
] as const
export type ServerRole = (typeof SERVER_ROLES)[number]

export const RUN_MODES = ["RUN", "STOP", "FAULT"] as const
export type RunMode = (typeof RUN_MODES)[number]

export const TABLE_NAMES = [
  "ingest_files",
  "cycles",
  "downtime",
  "alarms",
  "server_samples",
  "controllers",
] as const
export type TableName = (typeof TABLE_NAMES)[number]

export const APP_VIEWS = [
  "ingest",
  "dashboard",
  "triage",
  "olap",
  "losses",
  "servers",
  "explorer",
  "reports",
  "export",
] as const
export type AppView = (typeof APP_VIEWS)[number]

export type IngestFileRow = {
  file_id: string
  file_name: string
  source_share: string
  plant: string
  shift: string
  shift_date: string
  ingested_at: string
  byte_size: number
  cycle_count: number
  downtime_count: number
  alarm_count: number
  server_sample_count: number
  controller_count: number
  status: "ok" | "error"
  error_message: string
}

export type CycleRow = {
  cycle_id: string
  file_id: string
  plant: string
  line: string
  station: string
  machine: string
  controller_id: string
  work_order: string
  sku: string
  serial: string
  shift: string
  operator_id: string
  started_at: string
  ended_at: string
  cycle_ms: number
  target_cycle_ms: number
  result: CycleResult
  good_qty: number
  scrap_qty: number
  rework_qty: number
  fail_code: string
  fail_reason: string
}

export type DowntimeRow = {
  event_id: string
  file_id: string
  plant: string
  line: string
  station: string
  machine: string
  controller_id: string
  started_at: string
  ended_at: string
  duration_ms: number
  reason_code: string
  reason_text: string
  category: DowntimeCategory
  shift: string
}

export type AlarmRow = {
  alarm_id: string
  file_id: string
  plant: string
  line: string
  station: string
  machine: string
  controller_id: string
  raised_at: string
  cleared_at: string
  severity: AlarmSeverity
  code: string
  message: string
  ack_state: string
}

export type ServerSampleRow = {
  sample_id: string
  file_id: string
  plant: string
  line: string
  server_id: string
  server_role: ServerRole
  sampled_at: string
  cpu_pct: number
  mem_pct: number
  disk_pct: number
  plc_scan_ms: number
  heartbeat_ms: number
  queue_depth: number
  missed_heartbeats: number
  session_count: number
  network_err: number
  temperature_c: number
}

export type ControllerRow = {
  controller_id: string
  file_id: string
  plant: string
  line: string
  station: string
  machine: string
  vendor: string
  model: string
  firmware: string
  ip_address: string
  rack: number
  slot: number
  scan_ms_avg: number
  scan_ms_p95: number
  io_faults: number
  last_fault_code: string
  last_seen: string
  run_mode: RunMode
}

export type ProductionBatch = {
  file: IngestFileRow
  cycles: CycleRow[]
  downtime: DowntimeRow[]
  alarms: AlarmRow[]
  server_samples: ServerSampleRow[]
  controllers: ControllerRow[]
}

export type ProductionFilters = {
  plants: string[]
  lines: string[]
  stations: string[]
  machines: string[]
  controllers: string[]
  servers: string[]
  shifts: string[]
  skus: string[]
  workOrders: string[]
  results: CycleResult[]
  severities: AlarmSeverity[]
  downtimeCategories: DowntimeCategory[]
  from: string | null
  to: string | null
  search: string
  minCycleMs: number | null
  maxCycleMs: number | null
  onlyAnomalies: boolean
}

export type FilterFacet = {
  plants: string[]
  lines: string[]
  stations: string[]
  machines: string[]
  controllers: string[]
  servers: string[]
  shifts: string[]
  skus: string[]
  workOrders: string[]
}

export type ReportTone = "ok" | "warn" | "bad"

export type ReportKpi = {
  label: string
  value: string
  tone: ReportTone
}

export type ReportTable = {
  title: string
  columns: string[]
  rows: string[][]
}

export type AutoReport = {
  id: string
  title: string
  generatedAt: string
  summary: string
  kpis: ReportKpi[]
  findings: string[]
  tables: ReportTable[]
}

export function isCycleResult(value: string): value is CycleResult {
  return (CYCLE_RESULTS as readonly string[]).includes(value)
}

export function isAlarmSeverity(value: string): value is AlarmSeverity {
  return (ALARM_SEVERITIES as readonly string[]).includes(value)
}

export function isDowntimeCategory(value: string): value is DowntimeCategory {
  return (DOWNTIME_CATEGORIES as readonly string[]).includes(value)
}

export function isServerRole(value: string): value is ServerRole {
  return (SERVER_ROLES as readonly string[]).includes(value)
}

export function isRunMode(value: string): value is RunMode {
  return (RUN_MODES as readonly string[]).includes(value)
}

export function isTableName(value: string): value is TableName {
  return (TABLE_NAMES as readonly string[]).includes(value)
}

export function isAppView(value: string): value is AppView {
  return (APP_VIEWS as readonly string[]).includes(value)
}

export function resolveAppView(value: string): AppView | null {
  if (value === "pricing") {
    return "losses"
  }
  if (isAppView(value)) {
    return value
  }
  return null
}
