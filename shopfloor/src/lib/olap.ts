import { sqlFrom } from "@/lib/filters"
import {
  isCycleResult,
  type ProductionFilters,
} from "@/lib/types"

export const OLAP_DIMENSION_IDS = [
  "plant",
  "line",
  "station",
  "machine",
  "shift",
  "sku",
  "result",
  "hour",
] as const
export type OlapDimensionId = (typeof OLAP_DIMENSION_IDS)[number]

export const OLAP_MEASURE_IDS = [
  "cycles",
  "units",
  "good_units",
  "scrap_units",
  "fpy_pct",
  "avg_cycle_ms",
  "downtime_min",
  "open_alarms",
] as const
export type OlapMeasureId = (typeof OLAP_MEASURE_IDS)[number]

const CYCLE_MEASURES = [
  "cycles",
  "units",
  "good_units",
  "scrap_units",
  "fpy_pct",
  "avg_cycle_ms",
] as const satisfies readonly OlapMeasureId[]

const DOWNTIME_DIMS: readonly OlapDimensionId[] = [
  "plant",
  "line",
  "station",
  "machine",
  "shift",
  "hour",
]

const ALARM_DIMS: readonly OlapDimensionId[] = [
  "plant",
  "line",
  "station",
  "machine",
  "hour",
]

export function isOlapDimensionId(value: string): value is OlapDimensionId {
  return (OLAP_DIMENSION_IDS as readonly string[]).includes(value)
}

export function isOlapMeasureId(value: string): value is OlapMeasureId {
  return (OLAP_MEASURE_IDS as readonly string[]).includes(value)
}

export function sanitizeOlapDimensions(raw: unknown): OlapDimensionId[] {
  if (!Array.isArray(raw)) {
    return ["plant", "line"]
  }
  const out: OlapDimensionId[] = []
  for (const item of raw) {
    if (typeof item === "string" && isOlapDimensionId(item) && !out.includes(item)) {
      out.push(item)
    }
  }
  return out
}

export function sanitizeOlapMeasures(raw: unknown): OlapMeasureId[] {
  if (!Array.isArray(raw)) {
    return ["cycles", "units", "fpy_pct"]
  }
  const out: OlapMeasureId[] = []
  for (const item of raw) {
    if (typeof item === "string" && isOlapMeasureId(item) && !out.includes(item)) {
      out.push(item)
    }
  }
  if (out.length === 0) {
    return ["cycles", "units", "fpy_pct"]
  }
  return out
}

export function olapCompatibleMeasures(
  dimensions: readonly OlapDimensionId[],
  measures: readonly OlapMeasureId[]
): OlapMeasureId[] {
  return measures.filter((measure) => {
    switch (measure) {
      case "cycles":
      case "units":
      case "good_units":
      case "scrap_units":
      case "fpy_pct":
      case "avg_cycle_ms":
        return true
      case "downtime_min":
        return dimensions.every((dim) => DOWNTIME_DIMS.includes(dim))
      case "open_alarms":
        return dimensions.every((dim) => ALARM_DIMS.includes(dim))
      default: {
        const _exhaustive: never = measure
        return _exhaustive
      }
    }
  })
}

function hourExpr(clock: string): string {
  return `strftime(CAST(${clock} AS TIMESTAMP), '%Y-%m-%d %H:00')`
}

function dimensionSelect(
  id: OlapDimensionId,
  clock: string
): { expr: string; alias: string } {
  if (id === "hour") {
    return { expr: hourExpr(clock), alias: "hour" }
  }
  return { expr: id, alias: id }
}

function groupBySql(count: number): string {
  if (count === 0) {
    return ""
  }
  return `GROUP BY ${Array.from({ length: count }, (_, index) => index + 1).join(", ")}`
}

function cycleMeasureSql(measure: OlapMeasureId): string | null {
  switch (measure) {
    case "cycles":
      return "COUNT(*) AS cycles"
    case "units":
      return "SUM(good_qty + scrap_qty + rework_qty) AS units"
    case "good_units":
      return "SUM(good_qty) AS good_units"
    case "scrap_units":
      return "SUM(scrap_qty) AS scrap_units"
    case "fpy_pct":
      return `CASE WHEN SUM(good_qty + scrap_qty + rework_qty) = 0 THEN 0
                ELSE 100.0 * SUM(good_qty) / SUM(good_qty + scrap_qty + rework_qty)
           END AS fpy_pct`
    case "avg_cycle_ms":
      return "AVG(cycle_ms) AS avg_cycle_ms"
    case "downtime_min":
    case "open_alarms":
      return null
    default: {
      const _exhaustive: never = measure
      return _exhaustive
    }
  }
}

export function olapCubeSql(args: {
  filters: ProductionFilters
  dimensions: readonly OlapDimensionId[]
  measures: readonly OlapMeasureId[]
}): string {
  const dimensions = args.dimensions.filter(isOlapDimensionId)
  const measures = olapCompatibleMeasures(
    dimensions,
    args.measures.filter(isOlapMeasureId)
  )
  const cycleMeasures = measures.filter((measure) =>
    (CYCLE_MEASURES as readonly OlapMeasureId[]).includes(measure)
  )
  const wantDowntime = measures.includes("downtime_min")
  const wantAlarms = measures.includes("open_alarms")
  const cycleSelects = [
    ...dimensions.map((id) => {
      const dim = dimensionSelect(id, "started_at")
      return `${dim.expr} AS ${dim.alias}`
    }),
    ...cycleMeasures.map((measure) => cycleMeasureSql(measure)).filter(
      (part) => part !== null
    ),
  ]
  if (cycleSelects.length === 0) {
    cycleSelects.push("COUNT(*) AS cycles")
  }
  const groupBy = groupBySql(dimensions.length)
  const usingList = dimensions.map((id) => id).join(", ")
  const using = usingList === "" ? "" : ` USING (${usingList})`

  const downtimeSelects = [
    ...dimensions.map((id) => {
      const dim = dimensionSelect(id, "started_at")
      return `${dim.expr} AS ${dim.alias}`
    }),
    "SUM(duration_ms) / 60000.0 AS downtime_min",
  ]
  const alarmSelects = [
    ...dimensions.map((id) => {
      const dim = dimensionSelect(id, "raised_at")
      return `${dim.expr} AS ${dim.alias}`
    }),
    "COUNT(*) FILTER (WHERE ack_state = 'OPEN') AS open_alarms",
  ]

  const ctes: string[] = [
    `cube_cycles AS (
      SELECT ${cycleSelects.join(", ")}
      FROM ${sqlFrom("cycles", args.filters)}
      ${groupBy}
    )`,
  ]
  if (wantDowntime) {
    ctes.push(`cube_downtime AS (
      SELECT ${downtimeSelects.join(", ")}
      FROM ${sqlFrom("downtime", args.filters)}
      ${groupBy}
    )`)
  }
  if (wantAlarms) {
    ctes.push(`cube_alarms AS (
      SELECT ${alarmSelects.join(", ")}
      FROM ${sqlFrom("alarms", args.filters)}
      ${groupBy}
    )`)
  }

  const extraSelects: string[] = []
  const joins: string[] = []
  if (wantDowntime) {
    extraSelects.push("COALESCE(d.downtime_min, 0) AS downtime_min")
    joins.push(
      using === ""
        ? "CROSS JOIN cube_downtime d"
        : `LEFT JOIN cube_downtime d${using}`
    )
  }
  if (wantAlarms) {
    extraSelects.push("COALESCE(a.open_alarms, 0) AS open_alarms")
    joins.push(
      using === ""
        ? "CROSS JOIN cube_alarms a"
        : `LEFT JOIN cube_alarms a${using}`
    )
  }

  const cycleAliases = [
    ...dimensions,
    ...cycleMeasures,
  ]
  const selectList = [
    ...cycleAliases.map((alias) => `c.${alias}`),
    ...extraSelects,
  ].join(", ")

  const order = cycleMeasures[0]
    ? `ORDER BY c.${cycleMeasures[0]} DESC`
    : wantDowntime
      ? "ORDER BY downtime_min DESC"
      : ""

  return `
    WITH ${ctes.join(",\n")}
    SELECT ${selectList}
    FROM cube_cycles c
    ${joins.join("\n")}
    ${order}
    LIMIT 500
  `
}

function hourWindow(bucket: string): { from: string; to: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):00$/.exec(bucket)
  if (!match) {
    return null
  }
  const date = match[1]
  const hourText = match[2]
  if (date === undefined || hourText === undefined) {
    return null
  }
  const hour = Number(hourText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null
  }
  const from = `${date}T${hourText}:00:00`
  if (hour === 23) {
    return { from, to: `${date}T23:59:59` }
  }
  const next = String(hour + 1).padStart(2, "0")
  return { from, to: `${date}T${next}:00:00` }
}

export function olapDicePatch(
  row: Record<string, unknown>
): Partial<ProductionFilters> {
  const patch: Partial<ProductionFilters> = {}
  if (typeof row.plant === "string" && row.plant !== "") {
    patch.plants = [row.plant]
  }
  if (typeof row.line === "string" && row.line !== "") {
    patch.lines = [row.line]
  }
  if (typeof row.station === "string" && row.station !== "") {
    patch.stations = [row.station]
  }
  if (typeof row.machine === "string" && row.machine !== "") {
    patch.machines = [row.machine]
  }
  if (typeof row.shift === "string" && row.shift !== "") {
    patch.shifts = [row.shift]
  }
  if (typeof row.sku === "string" && row.sku !== "") {
    patch.skus = [row.sku]
  }
  if (typeof row.result === "string" && isCycleResult(row.result)) {
    patch.results = [row.result]
  }
  if (typeof row.hour === "string") {
    const window = hourWindow(row.hour)
    if (window) {
      patch.from = window.from
      patch.to = window.to
    }
  }
  return patch
}
