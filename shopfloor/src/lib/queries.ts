import { sqlFrom } from "@/lib/filters"
import type { ProductionFilters } from "@/lib/types"

export function kpiSql(filters: ProductionFilters): string {
  const cycles = sqlFrom("cycles", filters)
  const downtime = sqlFrom("downtime", filters)
  const alarms = sqlFrom("alarms", filters)
  return `
    SELECT
      (SELECT COALESCE(SUM(good_qty + scrap_qty + rework_qty), 0) FROM ${cycles}) AS units,
      (SELECT COALESCE(SUM(good_qty), 0) FROM ${cycles}) AS good_units,
      (SELECT COALESCE(SUM(scrap_qty), 0) FROM ${cycles}) AS scrap_units,
      (SELECT COALESCE(SUM(rework_qty), 0) FROM ${cycles}) AS rework_units,
      (SELECT COUNT(*) FROM ${cycles}) AS cycle_count,
      (SELECT COALESCE(AVG(cycle_ms), 0) FROM ${cycles}) AS avg_cycle_ms,
      (SELECT COALESCE(AVG(target_cycle_ms), 0) FROM ${cycles}) AS avg_target_ms,
      (SELECT COALESCE(SUM(duration_ms), 0) FROM ${downtime}) AS downtime_ms,
      (SELECT COUNT(*) FROM ${alarms} WHERE severity = 'CRITICAL') AS critical_alarms,
      (SELECT COUNT(*) FROM ${alarms} WHERE ack_state = 'OPEN') AS open_alarms
  `
}

export function hourlyThroughputSql(filters: ProductionFilters): string {
  return `
    SELECT strftime(CAST(started_at AS TIMESTAMP), '%m-%d %H:00') AS bucket,
           COUNT(*) AS cycles,
           SUM(good_qty) AS good_units,
           SUM(scrap_qty) AS scrap_units
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY 1
    ORDER BY 1
  `
}

export function fpyByLineSql(filters: ProductionFilters): string {
  return `
    SELECT plant, line,
           SUM(good_qty) AS good_units,
           SUM(scrap_qty + rework_qty) AS defect_units,
           CASE WHEN SUM(good_qty + scrap_qty + rework_qty) = 0 THEN 0
                ELSE 100.0 * SUM(good_qty) / SUM(good_qty + scrap_qty + rework_qty)
           END AS fpy_pct,
           AVG(cycle_ms) AS avg_cycle_ms,
           AVG(target_cycle_ms) AS target_cycle_ms
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY plant, line
    ORDER BY fpy_pct ASC
  `
}

export function downtimeParetoSql(filters: ProductionFilters): string {
  return `
    SELECT reason_code, category,
           COUNT(*) AS events,
           SUM(duration_ms) / 60000.0 AS minutes
    FROM ${sqlFrom("downtime", filters)}
    GROUP BY reason_code, category
    ORDER BY minutes DESC
    LIMIT 12
  `
}

export function failCodesSql(filters: ProductionFilters): string {
  return `
    SELECT fail_code, fail_reason, COUNT(*) AS hits
    FROM ${sqlFrom("cycles", filters)}
    WHERE result = 'FAIL' AND fail_code <> ''
    GROUP BY fail_code, fail_reason
    ORDER BY hits DESC
    LIMIT 12
  `
}

export function triageTreeSql(filters: ProductionFilters): string {
  return `
    SELECT plant, line, station, machine, controller_id,
           COUNT(*) AS cycles,
           SUM(CASE WHEN result <> 'PASS' THEN 1 ELSE 0 END) AS defects,
           AVG(cycle_ms) AS avg_cycle_ms
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY 1,2,3,4,5
    ORDER BY defects DESC, cycles DESC
  `
}

export function longDowntimeSql(filters: ProductionFilters): string {
  return `
    SELECT event_id, plant, line, station, machine, reason_code, reason_text,
           category, duration_ms, started_at
    FROM ${sqlFrom("downtime", filters)}
    ORDER BY duration_ms DESC
    LIMIT 25
  `
}

export function openAlarmsSql(filters: ProductionFilters): string {
  return `
    SELECT alarm_id, plant, line, station, machine, controller_id,
           severity, code, message, ack_state, raised_at
    FROM ${sqlFrom("alarms", filters)}
    ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END,
             raised_at DESC
    LIMIT 40
  `
}

export function serverLatestSql(filters: ProductionFilters): string {
  return `
    SELECT s.plant, s.line, s.server_id, s.server_role, s.sampled_at,
           s.cpu_pct, s.mem_pct, s.disk_pct, s.plc_scan_ms, s.heartbeat_ms,
           s.queue_depth, s.missed_heartbeats, s.session_count,
           s.network_err, s.temperature_c
    FROM ${sqlFrom("server_samples", filters)} s
    QUALIFY ROW_NUMBER() OVER (PARTITION BY server_id ORDER BY sampled_at DESC) = 1
    ORDER BY cpu_pct DESC
  `
}

export function serverSeriesSql(
  filters: ProductionFilters,
  serverId: string
): string {
  const escaped = serverId.replaceAll("'", "''")
  return `
    SELECT sampled_at, cpu_pct, mem_pct, plc_scan_ms, heartbeat_ms,
           queue_depth, missed_heartbeats, temperature_c
    FROM ${sqlFrom("server_samples", filters)}
    WHERE server_id = '${escaped}'
    ORDER BY sampled_at
  `
}

export function controllersSql(filters: ProductionFilters): string {
  return `
    SELECT controller_id, plant, line, station, machine, vendor, model,
           firmware, ip_address, rack, slot, scan_ms_avg, scan_ms_p95,
           io_faults, last_fault_code, last_seen, run_mode
    FROM ${sqlFrom("controllers", filters)}
    ORDER BY io_faults DESC, scan_ms_p95 DESC
  `
}

export const FACET_SQL = {
  plants: `SELECT DISTINCT plant AS value FROM cycles WHERE plant <> '' ORDER BY 1`,
  lines: `SELECT DISTINCT line AS value FROM cycles WHERE line <> '' ORDER BY 1`,
  stations: `SELECT DISTINCT station AS value FROM cycles WHERE station <> '' ORDER BY 1`,
  machines: `SELECT DISTINCT machine AS value FROM cycles WHERE machine <> '' ORDER BY 1`,
  controllers: `SELECT DISTINCT controller_id AS value FROM cycles WHERE controller_id <> '' ORDER BY 1`,
  servers: `SELECT DISTINCT server_id AS value FROM server_samples WHERE server_id <> '' ORDER BY 1`,
  shifts: `SELECT DISTINCT shift AS value FROM cycles WHERE shift <> '' ORDER BY 1`,
  skus: `SELECT DISTINCT sku AS value FROM cycles WHERE sku <> '' ORDER BY 1`,
  workOrders: `SELECT DISTINCT work_order AS value FROM cycles WHERE work_order <> '' ORDER BY 1`,
} as const

export function explorerSql(args: {
  table: "cycles" | "downtime" | "alarms" | "server_samples" | "controllers" | "ingest_files"
  filters: ProductionFilters
  sortColumn: string
  sortDir: "ASC" | "DESC"
  limit: number
  offset: number
}): string {
  const ident = args.sortColumn.replace(/[^A-Za-z0-9_]/g, "")
  const direction = args.sortDir === "ASC" ? "ASC" : "DESC"
  return `
    SELECT * FROM ${sqlFrom(args.table, args.filters)}
    ORDER BY ${ident} ${direction}
    LIMIT ${args.limit} OFFSET ${args.offset}
  `
}

export function oeeSql(filters: ProductionFilters): string {
  return `
    WITH span AS (
      SELECT
        COALESCE(date_diff('millisecond',
          CAST(MIN(started_at) AS TIMESTAMP),
          CAST(MAX(ended_at) AS TIMESTAMP)), 0) AS window_ms,
        COALESCE(SUM(good_qty + scrap_qty + rework_qty), 0) AS units,
        COALESCE(SUM(good_qty), 0) AS good_units,
        COALESCE(AVG(target_cycle_ms), 0) AS target_cycle_ms
      FROM ${sqlFrom("cycles", filters)}
    ),
    losses AS (
      SELECT COALESCE(SUM(duration_ms), 0) AS unplanned_ms
      FROM ${sqlFrom("downtime", filters)}
      WHERE category = 'UNPLANNED'
    )
    SELECT
      span.window_ms,
      losses.unplanned_ms,
      span.units,
      span.good_units,
      span.target_cycle_ms
    FROM span, losses
  `
}

export function cycleHistogramSql(filters: ProductionFilters): string {
  return `
    SELECT (CAST(cycle_ms / 1000 AS INTEGER) * 1000) AS bucket_ms,
           COUNT(*) AS cycles
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY 1
    ORDER BY 1
  `
}

export function shiftCompareSql(filters: ProductionFilters): string {
  return `
    SELECT shift, line,
           COUNT(*) AS cycles,
           SUM(good_qty) AS good_units,
           SUM(scrap_qty) AS scrap_units,
           CASE WHEN SUM(good_qty + scrap_qty + rework_qty) = 0 THEN 0
                ELSE 100.0 * SUM(good_qty) / SUM(good_qty + scrap_qty + rework_qty)
           END AS fpy_pct,
           AVG(cycle_ms) AS avg_cycle_ms
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY shift, line
    ORDER BY shift, fpy_pct ASC
  `
}

export function explorerCountSql(args: {
  table: "cycles" | "downtime" | "alarms" | "server_samples" | "controllers" | "ingest_files"
  filters: ProductionFilters
}): string {
  return `SELECT COUNT(*) AS n FROM ${sqlFrom(args.table, args.filters)}`
}
