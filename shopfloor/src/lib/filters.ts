import type { ProductionFilters, TableName } from "@/lib/types"

export const EMPTY_FILTERS: ProductionFilters = {
  plants: [],
  lines: [],
  stations: [],
  machines: [],
  controllers: [],
  servers: [],
  shifts: [],
  skus: [],
  workOrders: [],
  results: [],
  severities: [],
  downtimeCategories: [],
  from: null,
  to: null,
  search: "",
  minCycleMs: null,
  maxCycleMs: null,
  onlyAnomalies: false,
}

export function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}

function inList(column: string, values: readonly string[]): string | null {
  if (values.length === 0) {
    return null
  }
  const body = values.map((value) => `'${escapeSqlLiteral(value)}'`).join(", ")
  return `${column} IN (${body})`
}

function timeColumn(table: TableName): string | null {
  switch (table) {
    case "cycles":
    case "downtime":
      return "started_at"
    case "alarms":
      return "raised_at"
    case "server_samples":
      return "sampled_at"
    case "controllers":
      return "last_seen"
    case "ingest_files":
      return "ingested_at"
    default: {
      const _exhaustive: never = table
      return _exhaustive
    }
  }
}

function searchColumns(table: TableName): string[] {
  switch (table) {
    case "cycles":
      return [
        "cycle_id",
        "work_order",
        "sku",
        "serial",
        "fail_code",
        "fail_reason",
        "operator_id",
      ]
    case "downtime":
      return ["event_id", "reason_code", "reason_text"]
    case "alarms":
      return ["alarm_id", "code", "message"]
    case "server_samples":
      return ["server_id", "server_role"]
    case "controllers":
      return [
        "controller_id",
        "vendor",
        "model",
        "firmware",
        "ip_address",
        "last_fault_code",
      ]
    case "ingest_files":
      return ["file_name", "source_share", "plant"]
    default: {
      const _exhaustive: never = table
      return _exhaustive
    }
  }
}

export function sqlWhere(
  filters: ProductionFilters,
  table: TableName
): string {
  const clauses: string[] = []

  const plants = inList("plant", filters.plants)
  if (plants) {
    clauses.push(plants)
  }

  if (table !== "ingest_files") {
    const lines = inList("line", filters.lines)
    if (lines) {
      clauses.push(lines)
    }
  }

  if (
    table === "cycles" ||
    table === "downtime" ||
    table === "alarms" ||
    table === "controllers"
  ) {
    const stations = inList("station", filters.stations)
    if (stations) {
      clauses.push(stations)
    }
    const machines = inList("machine", filters.machines)
    if (machines) {
      clauses.push(machines)
    }
    const controllers = inList("controller_id", filters.controllers)
    if (controllers) {
      clauses.push(controllers)
    }
  }

  if (table === "server_samples") {
    const servers = inList("server_id", filters.servers)
    if (servers) {
      clauses.push(servers)
    }
  }

  if (table === "cycles" || table === "downtime" || table === "ingest_files") {
    const shifts = inList("shift", filters.shifts)
    if (shifts) {
      clauses.push(shifts)
    }
  }

  if (table === "cycles") {
    const skus = inList("sku", filters.skus)
    if (skus) {
      clauses.push(skus)
    }
    const workOrders = inList("work_order", filters.workOrders)
    if (workOrders) {
      clauses.push(workOrders)
    }
    const results = inList("result", filters.results)
    if (results) {
      clauses.push(results)
    }
    if (filters.minCycleMs !== null) {
      clauses.push(`cycle_ms >= ${filters.minCycleMs}`)
    }
    if (filters.maxCycleMs !== null) {
      clauses.push(`cycle_ms <= ${filters.maxCycleMs}`)
    }
    if (filters.onlyAnomalies) {
      clauses.push(
        "(result <> 'PASS' OR (target_cycle_ms > 0 AND cycle_ms > target_cycle_ms * 1.2))"
      )
    }
  }

  if (table === "alarms") {
    const severities = inList("severity", filters.severities)
    if (severities) {
      clauses.push(severities)
    }
  }

  if (table === "downtime") {
    const categories = inList("category", filters.downtimeCategories)
    if (categories) {
      clauses.push(categories)
    }
  }

  if (table === "server_samples" && filters.onlyAnomalies) {
    clauses.push(
      "(cpu_pct >= 85 OR missed_heartbeats > 0 OR plc_scan_ms >= 20 OR queue_depth >= 25)"
    )
  }

  if (table === "controllers" && filters.onlyAnomalies) {
    clauses.push("(run_mode <> 'RUN' OR io_faults > 0 OR scan_ms_p95 >= 20)")
  }

  const clock = timeColumn(table)
  if (clock && filters.from) {
    clauses.push(`${clock} >= '${escapeSqlLiteral(filters.from)}'`)
  }
  if (clock && filters.to) {
    clauses.push(`${clock} <= '${escapeSqlLiteral(filters.to)}'`)
  }

  const needle = filters.search.trim()
  if (needle !== "") {
    const like = `'%${escapeSqlLiteral(needle)}%'`
    const parts = searchColumns(table).map(
      (column) => `CAST(${column} AS VARCHAR) ILIKE ${like}`
    )
    if (parts.length > 0) {
      clauses.push(`(${parts.join(" OR ")})`)
    }
  }

  if (clauses.length === 0) {
    return ""
  }
  return `WHERE ${clauses.join(" AND ")}`
}

export function sqlFrom(table: TableName, filters: ProductionFilters): string {
  const where = sqlWhere(filters, table)
  if (where === "") {
    return table
  }
  return `(SELECT * FROM ${table} ${where})`
}

export function activeFilterCount(filters: ProductionFilters): number {
  let count = 0
  count += filters.plants.length
  count += filters.lines.length
  count += filters.stations.length
  count += filters.machines.length
  count += filters.controllers.length
  count += filters.servers.length
  count += filters.shifts.length
  count += filters.skus.length
  count += filters.workOrders.length
  count += filters.results.length
  count += filters.severities.length
  count += filters.downtimeCategories.length
  if (filters.from) count += 1
  if (filters.to) count += 1
  if (filters.search.trim() !== "") count += 1
  if (filters.minCycleMs !== null) count += 1
  if (filters.maxCycleMs !== null) count += 1
  if (filters.onlyAnomalies) count += 1
  return count
}

export function encodeFilters(filters: ProductionFilters): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(filters))))
}

export function decodeFilters(raw: string): ProductionFilters | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(escape(atob(raw))))
    if (!parsed || typeof parsed !== "object") {
      return null
    }
    return { ...EMPTY_FILTERS, ...parsed } as ProductionFilters
  } catch {
    return null
  }
}

export function toggleValue<T extends string>(
  values: T[],
  next: T
): T[] {
  if (values.includes(next)) {
    return values.filter((value) => value !== next)
  }
  return [...values, next]
}
