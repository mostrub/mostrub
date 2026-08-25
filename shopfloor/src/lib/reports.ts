import { queryRows } from "@/lib/duckdb/engine"
import { sqlFrom } from "@/lib/filters"
import type { AutoReport, ProductionFilters } from "@/lib/types"

function num(value: string | number | boolean | null): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function str(value: string | number | boolean | null): string {
  if (value === null) {
    return ""
  }
  return String(value)
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function minutes(ms: number): string {
  return `${(ms / 60000).toFixed(1)} min`
}

export async function buildAutoReports(
  filters: ProductionFilters
): Promise<AutoReport[]> {
  const generatedAt = new Date().toISOString()
  const [shift, triage, servers] = await Promise.all([
    buildShiftReport(filters, generatedAt),
    buildTriageReport(filters, generatedAt),
    buildServerReport(filters, generatedAt),
  ])
  return [shift, triage, servers]
}

async function buildShiftReport(
  filters: ProductionFilters,
  generatedAt: string
): Promise<AutoReport> {
  const kpiRows = await queryRows(`
    SELECT
      COALESCE(SUM(good_qty + scrap_qty + rework_qty), 0) AS units,
      COALESCE(SUM(good_qty), 0) AS good_units,
      COALESCE(SUM(scrap_qty), 0) AS scrap_units,
      COALESCE(AVG(cycle_ms), 0) AS avg_cycle_ms,
      COALESCE(AVG(target_cycle_ms), 0) AS avg_target_ms
    FROM ${sqlFrom("cycles", filters)}
  `)
  const kpi = kpiRows[0]
  const units = num(kpi?.units ?? 0)
  const good = num(kpi?.good_units ?? 0)
  const scrap = num(kpi?.scrap_units ?? 0)
  const fpy = units === 0 ? 0 : (100 * good) / units
  const pace =
    num(kpi?.avg_target_ms ?? 0) === 0
      ? 0
      : (100 * num(kpi?.avg_target_ms ?? 0)) / num(kpi?.avg_cycle_ms ?? 1)

  const lines = await queryRows(`
    SELECT plant, line, SUM(good_qty) AS good_units,
           100.0 * SUM(good_qty) / NULLIF(SUM(good_qty + scrap_qty + rework_qty), 0) AS fpy_pct
    FROM ${sqlFrom("cycles", filters)}
    GROUP BY plant, line
    ORDER BY fpy_pct ASC
  `)

  const findings: string[] = []
  if (fpy < 95) {
    findings.push(`First-pass yield is ${pct(fpy)}, below the 95% shop target.`)
  } else {
    findings.push(`First-pass yield is ${pct(fpy)}.`)
  }
  const worst = lines[0]
  if (worst) {
    findings.push(
      `${str(worst.plant)} ${str(worst.line)} is the weakest line at ${pct(num(worst.fpy_pct))}.`
    )
  }
  if (pace < 90) {
    findings.push(`Average cycle time is ${pct(100 - pace)} slower than target.`)
  }

  return {
    id: "shift-production",
    title: "Shift production",
    generatedAt,
    summary: `${units.toFixed(0)} units across the current filter, ${scrap.toFixed(0)} scrap.`,
    kpis: [
      { label: "Units", value: units.toFixed(0), tone: "ok" },
      { label: "FPY", value: pct(fpy), tone: fpy < 95 ? "bad" : fpy < 98 ? "warn" : "ok" },
      { label: "Pace vs target", value: pct(pace), tone: pace < 90 ? "warn" : "ok" },
      { label: "Scrap", value: scrap.toFixed(0), tone: scrap > 0 ? "warn" : "ok" },
    ],
    findings,
    tables: [
      {
        title: "Yield by line",
        columns: ["Plant", "Line", "Good", "FPY"],
        rows: lines.map((row) => [
          str(row.plant),
          str(row.line),
          str(row.good_units),
          pct(num(row.fpy_pct)),
        ]),
      },
    ],
  }
}

async function buildTriageReport(
  filters: ProductionFilters,
  generatedAt: string
): Promise<AutoReport> {
  const dt = await queryRows(`
    SELECT reason_code, category, SUM(duration_ms) AS duration_ms, COUNT(*) AS events
    FROM ${sqlFrom("downtime", filters)}
    GROUP BY 1, 2
    ORDER BY duration_ms DESC
    LIMIT 8
  `)
  const alarms = await queryRows(`
    SELECT severity, COUNT(*) AS n
    FROM ${sqlFrom("alarms", filters)}
    GROUP BY 1
    ORDER BY n DESC
  `)
  const open = await queryRows(`
    SELECT COUNT(*) AS n FROM ${sqlFrom("alarms", filters)} WHERE ack_state = 'OPEN'
  `)
  const totalDt = dt.reduce((sum, row) => sum + num(row.duration_ms), 0)
  const critical = alarms.find((row) => str(row.severity) === "CRITICAL")
  const findings: string[] = []
  const top = dt[0]
  if (top) {
    findings.push(
      `${str(top.reason_code)} is the top loss at ${minutes(num(top.duration_ms))} (${str(top.events)} events).`
    )
  }
  findings.push(`${str(open[0]?.n ?? 0)} alarms are still OPEN.`)
  if (critical) {
    findings.push(`${str(critical.n)} critical alarms in the current window.`)
  }

  return {
    id: "loss-triage",
    title: "Loss triage",
    generatedAt,
    summary: `${minutes(totalDt)} of recorded downtime in scope.`,
    kpis: [
      {
        label: "Downtime",
        value: minutes(totalDt),
        tone: totalDt > 3600_000 ? "bad" : "warn",
      },
      {
        label: "Open alarms",
        value: str(open[0]?.n ?? 0),
        tone: num(open[0]?.n ?? 0) > 0 ? "bad" : "ok",
      },
      {
        label: "Critical alarms",
        value: str(critical?.n ?? 0),
        tone: num(critical?.n ?? 0) > 0 ? "bad" : "ok",
      },
    ],
    findings,
    tables: [
      {
        title: "Downtime Pareto",
        columns: ["Code", "Category", "Events", "Minutes"],
        rows: dt.map((row) => [
          str(row.reason_code),
          str(row.category),
          str(row.events),
          (num(row.duration_ms) / 60000).toFixed(1),
        ]),
      },
    ],
  }
}

async function buildServerReport(
  filters: ProductionFilters,
  generatedAt: string
): Promise<AutoReport> {
  const hot = await queryRows(`
    SELECT server_id, server_role, line,
           AVG(cpu_pct) AS cpu_pct,
           AVG(plc_scan_ms) AS plc_scan_ms,
           SUM(missed_heartbeats) AS missed,
           MAX(queue_depth) AS queue_depth
    FROM ${sqlFrom("server_samples", filters)}
    GROUP BY 1, 2, 3
    ORDER BY cpu_pct DESC
    LIMIT 8
  `)
  const faulted = await queryRows(`
    SELECT controller_id, line, run_mode, io_faults, scan_ms_p95, last_fault_code
    FROM ${sqlFrom("controllers", filters)}
    WHERE run_mode <> 'RUN' OR io_faults > 0
    ORDER BY io_faults DESC
  `)
  const findings: string[] = []
  const worst = hot[0]
  if (worst) {
    findings.push(
      `${str(worst.server_id)} averages ${num(worst.cpu_pct).toFixed(1)}% CPU with ${str(worst.missed)} missed heartbeats.`
    )
  }
  if (faulted.length > 0) {
    findings.push(
      `${faulted.length} controllers are faulted or showing I/O faults.`
    )
  } else {
    findings.push("No controllers are currently in FAULT.")
  }

  return {
    id: "server-health",
    title: "Server and controller health",
    generatedAt,
    summary: "Profiling snapshot for MES, HMI, gateway, and PLC controllers.",
    kpis: [
      {
        label: "Hottest server CPU",
        value: worst ? `${num(worst.cpu_pct).toFixed(1)}%` : "n/a",
        tone: num(worst?.cpu_pct ?? 0) >= 85 ? "bad" : "ok",
      },
      {
        label: "Controllers in trouble",
        value: String(faulted.length),
        tone: faulted.length > 0 ? "bad" : "ok",
      },
      {
        label: "Missed heartbeats (top)",
        value: str(worst?.missed ?? 0),
        tone: num(worst?.missed ?? 0) > 0 ? "warn" : "ok",
      },
    ],
    findings,
    tables: [
      {
        title: "Servers",
        columns: ["Server", "Role", "Line", "CPU", "Scan ms", "Missed", "Queue"],
        rows: hot.map((row) => [
          str(row.server_id),
          str(row.server_role),
          str(row.line),
          num(row.cpu_pct).toFixed(1),
          num(row.plc_scan_ms).toFixed(1),
          str(row.missed),
          str(row.queue_depth),
        ]),
      },
      {
        title: "Controllers",
        columns: ["Controller", "Line", "Mode", "I/O faults", "P95 scan", "Last fault"],
        rows: faulted.map((row) => [
          str(row.controller_id),
          str(row.line),
          str(row.run_mode),
          str(row.io_faults),
          num(row.scan_ms_p95).toFixed(1),
          str(row.last_fault_code),
        ]),
      },
    ],
  }
}

export function reportToText(report: AutoReport): string {
  const lines = [
    report.title,
    report.generatedAt,
    report.summary,
    "",
    ...report.kpis.map((kpi) => `${kpi.label}: ${kpi.value}`),
    "",
    "Findings",
    ...report.findings.map((finding) => `- ${finding}`),
  ]
  for (const table of report.tables) {
    lines.push("", table.title, table.columns.join(","))
    for (const row of table.rows) {
      lines.push(row.join(","))
    }
  }
  return lines.join("\n")
}
