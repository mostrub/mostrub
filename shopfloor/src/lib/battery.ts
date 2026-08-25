import { sqlFrom } from "@/lib/filters"
import type { ProductionFilters } from "@/lib/types"

export type BatterySku = {
  sku: string
  name: string
  listPrice: number
  materialCost: number
}

export type LineEdge = {
  upstreamPlant: string
  upstreamLine: string
  downstreamPlant: string
  downstreamLine: string
}

export const BATTERY_SKUS: BatterySku[] = [
  {
    sku: "CELL-2170",
    name: "2170 NMC cell",
    listPrice: 4.85,
    materialCost: 2.1,
  },
  {
    sku: "CELL-4680",
    name: "4680 NMC cell",
    listPrice: 8.4,
    materialCost: 3.75,
  },
  {
    sku: "MOD-12S",
    name: "12s module",
    listPrice: 72,
    materialCost: 34,
  },
  {
    sku: "PACK-400V",
    name: "400V pack",
    listPrice: 890,
    materialCost: 420,
  },
]

export const SHIFT_LABOR_RATE: Record<"A" | "B", number> = {
  A: 42,
  B: 51,
}

export const LINE_EDGES: LineEdge[] = [
  {
    upstreamPlant: "AUSTIN",
    upstreamLine: "CELL-1",
    downstreamPlant: "AUSTIN",
    downstreamLine: "MOD-1",
  },
  {
    upstreamPlant: "AUSTIN",
    upstreamLine: "MOD-1",
    downstreamPlant: "DALLAS",
    downstreamLine: "PACK-1",
  },
]

export function shiftLaborRate(shift: string): number {
  if (shift === "B") {
    return SHIFT_LABOR_RATE.B
  }
  return SHIFT_LABOR_RATE.A
}

export function unitCost(args: {
  materialCost: number
  cycleMs: number
  laborRatePerHour: number
  scrapQty: number
  goodQty: number
  downtimeMin: number
}): number {
  const labor = (args.cycleMs / 3_600_000) * args.laborRatePerHour
  const scrap =
    args.goodQty === 0
      ? args.materialCost
      : (args.scrapQty * args.materialCost) / args.goodQty
  const downtime =
    args.goodQty === 0
      ? 0
      : ((args.downtimeMin / 60) * args.laborRatePerHour) / args.goodQty
  return args.materialCost + labor + scrap + downtime
}

export function unitMargin(args: { listPrice: number; unitCost: number }): {
  margin: number
  marginPct: number
} {
  const margin = args.listPrice - args.unitCost
  return {
    margin,
    marginPct: args.listPrice === 0 ? 0 : (100 * margin) / args.listPrice,
  }
}

export function starvedDownstream(args: {
  edges: readonly LineEdge[]
  unplannedMinByLine: Record<string, number>
}): Array<
  LineEdge & {
    upstreamDowntimeMin: number
  }
> {
  return args.edges
    .map((edge) => ({
      ...edge,
      upstreamDowntimeMin:
        args.unplannedMinByLine[`${edge.upstreamPlant}|${edge.upstreamLine}`] ??
        0,
    }))
    .filter((row) => row.upstreamDowntimeMin > 0)
}

function skuCatalogSql(): string {
  const rows = BATTERY_SKUS.map(
    (sku) =>
      `('${sku.sku}', ${sku.listPrice}, ${sku.materialCost})`
  ).join(", ")
  return `(VALUES ${rows}) AS catalog(sku, list_price, material_cost)`
}

function shiftLaborSql(): string {
  return `(VALUES ('A', ${SHIFT_LABOR_RATE.A}), ('B', ${SHIFT_LABOR_RATE.B})) AS labor(shift, rate_per_hour)`
}

function lineEdgesSql(): string {
  const rows = LINE_EDGES.map(
    (edge) =>
      `('${edge.upstreamPlant}', '${edge.upstreamLine}', '${edge.downstreamPlant}', '${edge.downstreamLine}')`
  ).join(", ")
  return `(VALUES ${rows}) AS edges(up_plant, up_line, down_plant, down_line)`
}

export function pricingSql(filters: ProductionFilters): string {
  const cycles = sqlFrom("cycles", filters)
  const downtime = sqlFrom("downtime", filters)
  return `
    WITH cycle_grain AS (
      SELECT sku, shift, plant, line,
             SUM(good_qty + scrap_qty + rework_qty) AS units,
             SUM(good_qty) AS good_units,
             SUM(scrap_qty) AS scrap_units,
             AVG(cycle_ms) AS avg_cycle_ms
      FROM ${cycles}
      GROUP BY 1, 2, 3, 4
    ),
    dt_grain AS (
      SELECT plant, line, shift,
             SUM(duration_ms) / 60000.0 AS downtime_min
      FROM ${downtime}
      GROUP BY 1, 2, 3
    ),
    priced AS (
      SELECT
        g.sku, g.shift, g.plant, g.line,
        g.units, g.good_units, g.scrap_units,
        catalog.list_price,
        catalog.material_cost +
          (g.avg_cycle_ms / 3600000.0) * labor.rate_per_hour +
          CASE WHEN g.good_units = 0 THEN catalog.material_cost
               ELSE (g.scrap_units * catalog.material_cost) / g.good_units
          END +
          CASE WHEN g.good_units = 0 THEN 0
               ELSE (COALESCE(dt.downtime_min, 0) / 60.0) * labor.rate_per_hour / g.good_units
          END AS unit_cost,
        catalog.list_price - (
          catalog.material_cost +
          (g.avg_cycle_ms / 3600000.0) * labor.rate_per_hour +
          CASE WHEN g.good_units = 0 THEN catalog.material_cost
               ELSE (g.scrap_units * catalog.material_cost) / g.good_units
          END +
          CASE WHEN g.good_units = 0 THEN 0
               ELSE (COALESCE(dt.downtime_min, 0) / 60.0) * labor.rate_per_hour / g.good_units
          END
        ) AS margin,
        labor.rate_per_hour
      FROM cycle_grain g
      JOIN ${skuCatalogSql()} ON catalog.sku = g.sku
      JOIN ${shiftLaborSql()} ON labor.shift = g.shift
      LEFT JOIN dt_grain dt
        ON dt.plant = g.plant AND dt.line = g.line AND dt.shift = g.shift
    )
    SELECT
      sku, shift, plant, line, units, good_units, scrap_units,
      list_price, unit_cost, margin,
      CASE WHEN list_price = 0 THEN 0 ELSE 100.0 * margin / list_price END AS margin_pct,
      rate_per_hour
    FROM priced
    ORDER BY margin ASC
  `
}

export function weightedMarginPct(
  rows: ReadonlyArray<{
    list_price?: unknown
    unit_cost?: unknown
    good_units?: unknown
  }>
): number {
  let revenue = 0
  let cost = 0
  for (const row of rows) {
    const good = Number(row.good_units ?? 0)
    const price = Number(row.list_price ?? 0)
    const unit = Number(row.unit_cost ?? 0)
    if (!Number.isFinite(good) || !Number.isFinite(price) || !Number.isFinite(unit)) {
      continue
    }
    revenue += price * good
    cost += unit * good
  }
  if (revenue === 0) {
    return 0
  }
  return (100 * (revenue - cost)) / revenue
}

function pushUnique(list: string[], value: unknown): void {
  if (typeof value !== "string" || value === "") {
    return
  }
  if (!list.includes(value)) {
    list.push(value)
  }
}

export function pricingDicePatch(
  row: Record<string, unknown>
): Partial<ProductionFilters> {
  const patch: Partial<ProductionFilters> = {}
  if (typeof row.plant === "string" && row.plant !== "") {
    patch.plants = [row.plant]
  }
  if (typeof row.line === "string" && row.line !== "") {
    patch.lines = [row.line]
  }
  if (typeof row.shift === "string" && row.shift !== "") {
    patch.shifts = [row.shift]
  }
  if (typeof row.sku === "string" && row.sku !== "") {
    patch.skus = [row.sku]
  }
  return patch
}

export function dependentLineDicePatch(
  row: Record<string, unknown>
): Partial<ProductionFilters> {
  const plants: string[] = []
  const lines: string[] = []
  pushUnique(plants, row.up_plant)
  pushUnique(plants, row.down_plant)
  pushUnique(lines, row.up_line)
  pushUnique(lines, row.down_line)
  const patch: Partial<ProductionFilters> = {}
  if (plants.length > 0) {
    patch.plants = plants
  }
  if (lines.length > 0) {
    patch.lines = lines
  }
  return patch
}

export function dependentLineSql(filters: ProductionFilters): string {
  const downtime = sqlFrom("downtime", filters)
  return `
    SELECT
      e.up_plant, e.up_line, e.down_plant, e.down_line,
      COALESCE(u.downtime_min, 0) AS upstream_downtime_min,
      COALESCE(s.starve_min, 0) AS downstream_starve_min
    FROM ${lineEdgesSql()} e
    LEFT JOIN (
      SELECT plant, line, SUM(duration_ms) / 60000.0 AS downtime_min
      FROM ${downtime}
      WHERE category = 'UNPLANNED'
      GROUP BY 1, 2
    ) u ON u.plant = e.up_plant AND u.line = e.up_line
    LEFT JOIN (
      SELECT plant, line, SUM(duration_ms) / 60000.0 AS starve_min
      FROM ${downtime}
      WHERE reason_code = 'STARVE'
      GROUP BY 1, 2
    ) s ON s.plant = e.down_plant AND s.line = e.down_line
    ORDER BY upstream_downtime_min DESC
  `
}
