import { queryRows } from "@/lib/duckdb/engine"
import { sqlFrom } from "@/lib/filters"
import { formatMinutes, formatNumber, formatPct } from "@/lib/format"
import { valueLabel } from "@/lib/labels"
import { computeOee } from "@/lib/oee"
import { oeeSql } from "@/lib/queries"
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
  return formatPct(value)
}

function minutes(ms: number): string {
  return formatMinutes(ms)
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
    findings.push(`Erstausbeute liegt bei ${pct(fpy)}, unter dem 95-%-Ziel.`)
  } else {
    findings.push(`Erstausbeute liegt bei ${pct(fpy)}.`)
  }
  const oeeRow = (await queryRows(oeeSql(filters)))[0]
  const oee = computeOee({
    windowMs: num(oeeRow?.window_ms ?? 0),
    unplannedDowntimeMs: num(oeeRow?.unplanned_ms ?? 0),
    units: num(oeeRow?.units ?? 0),
    goodUnits: num(oeeRow?.good_units ?? 0),
    targetCycleMs: num(oeeRow?.target_cycle_ms ?? 0),
    idealMs: num(oeeRow?.ideal_ms ?? 0),
  })
  findings.push(
    `OEE liegt bei ${pct(oee.oee)} (V ${pct(oee.availability)} · L ${pct(oee.performance)} · Q ${pct(oee.quality)}).`
  )
  const worst = lines[0]
  if (worst) {
    findings.push(
      `${str(worst.plant)} ${str(worst.line)} ist die schwächste Linie mit ${pct(num(worst.fpy_pct))}.`
    )
  }
  if (pace < 90) {
    findings.push(`Mittlere Taktzeit ist ${pct(100 - pace)} langsamer als das Ziel.`)
  }

  return {
    id: "shift-production",
    title: "Schichtproduktion",
    generatedAt,
    summary: `${formatNumber(units)} Stück im aktuellen Filter, ${formatNumber(scrap)} Ausschuss.`,
    kpis: [
      { label: "Stück", value: formatNumber(units), tone: "ok" },
      { label: "Erstausbeute", value: pct(fpy), tone: fpy < 95 ? "bad" : fpy < 98 ? "warn" : "ok" },
      { label: "Tempo vs Ziel", value: pct(pace), tone: pace < 90 ? "warn" : "ok" },
      { label: "Ausschuss", value: formatNumber(scrap), tone: scrap > 0 ? "warn" : "ok" },
      {
        label: "OEE",
        value: pct(oee.oee),
        tone: oee.oee < 65 ? "bad" : oee.oee < 85 ? "warn" : "ok",
      },
    ],
    findings,
    tables: [
      {
        title: "Ausbeute je Linie",
        columns: ["Werk", "Linie", "Gutteile", "Erstausbeute"],
        rows: lines.map((row) => [
          str(row.plant),
          str(row.line),
          formatNumber(num(row.good_units)),
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
      `${valueLabel(str(top.reason_code))} ist der größte Verlust mit ${minutes(num(top.duration_ms))} (${str(top.events)} Ereignisse).`
    )
  }
  findings.push(`${str(open[0]?.n ?? 0)} Alarme sind noch offen.`)
  if (critical) {
    findings.push(`${str(critical.n)} kritische Alarme im aktuellen Fenster.`)
  }

  return {
    id: "loss-triage",
    title: "Verlust-Triage",
    generatedAt,
    summary: `${minutes(totalDt)} erfasster Stillstand im Ausschnitt.`,
    kpis: [
      {
        label: "Stillstand",
        value: minutes(totalDt),
        tone: totalDt > 3600_000 ? "bad" : "warn",
      },
      {
        label: "Offene Alarme",
        value: str(open[0]?.n ?? 0),
        tone: num(open[0]?.n ?? 0) > 0 ? "bad" : "ok",
      },
      {
        label: "Kritische Alarme",
        value: str(critical?.n ?? 0),
        tone: num(critical?.n ?? 0) > 0 ? "bad" : "ok",
      },
    ],
    findings,
    tables: [
      {
        title: "Stillstand-Pareto",
        columns: ["Code", "Kategorie", "Ereignisse", "Minuten"],
        rows: dt.map((row) => [
          valueLabel(str(row.reason_code)),
          valueLabel(str(row.category)),
          str(row.events),
          formatNumber(num(row.duration_ms) / 60000, 1),
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
      `${str(worst.server_id)} liegt im Schnitt bei ${formatNumber(num(worst.cpu_pct), 1)} % CPU mit ${str(worst.missed)} verpassten Impulsen.`
    )
  }
  if (faulted.length > 0) {
    findings.push(
      `${faulted.length} Steuerungen sind gestört oder zeigen E/A-Fehler.`
    )
  } else {
    findings.push("Keine Steuerung steht gerade in Störung.")
  }

  return {
    id: "server-health",
    title: "Server- und Steuerungszustand",
    generatedAt,
    summary: "Profilschnappschuss für MES, HMI, Gateway und SPS-Steuerungen.",
    kpis: [
      {
        label: "Heißeste Server-CPU",
        value: worst ? `${formatNumber(num(worst.cpu_pct), 1)} %` : "k. A.",
        tone: num(worst?.cpu_pct ?? 0) >= 85 ? "bad" : "ok",
      },
      {
        label: "Steuerungen in Störung",
        value: String(faulted.length),
        tone: faulted.length > 0 ? "bad" : "ok",
      },
      {
        label: "Verpasste Impulse (oben)",
        value: str(worst?.missed ?? 0),
        tone: num(worst?.missed ?? 0) > 0 ? "warn" : "ok",
      },
    ],
    findings,
    tables: [
      {
        title: "Server",
        columns: ["Server", "Rolle", "Linie", "CPU", "Scan ms", "Verpasst", "Warteschlange"],
        rows: hot.map((row) => [
          str(row.server_id),
          str(row.server_role),
          str(row.line),
          formatNumber(num(row.cpu_pct), 1),
          formatNumber(num(row.plc_scan_ms), 1),
          str(row.missed),
          str(row.queue_depth),
        ]),
      },
      {
        title: "Steuerungen",
        columns: ["Steuerung", "Linie", "Modus", "E/A-Fehler", "P95-Scan", "Letzter Fehler"],
        rows: faulted.map((row) => [
          str(row.controller_id),
          str(row.line),
          valueLabel(str(row.run_mode)),
          str(row.io_faults),
          formatNumber(num(row.scan_ms_p95), 1),
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
    "Befunde",
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
