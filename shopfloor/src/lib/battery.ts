import { sqlFrom } from "@/lib/filters"
import type { ProductionFilters } from "@/lib/types"

export type LineEdge = {
  upstreamPlant: string
  upstreamLine: string
  downstreamPlant: string
  downstreamLine: string
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

function lineEdgesSql(): string {
  const rows = LINE_EDGES.map(
    (edge) =>
      `('${edge.upstreamPlant}', '${edge.upstreamLine}', '${edge.downstreamPlant}', '${edge.downstreamLine}')`
  ).join(", ")
  return `(VALUES ${rows}) AS edges(up_plant, up_line, down_plant, down_line)`
}

function pushUnique(list: string[], value: unknown): void {
  if (typeof value !== "string" || value === "") {
    return
  }
  if (!list.includes(value)) {
    list.push(value)
  }
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

export function stationDicePatch(
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
  return patch
}

export function dependentLineSql(filters: ProductionFilters): string {
  const downtime = sqlFrom("downtime", filters)
  return `
    SELECT
      edges.up_plant, edges.up_line, edges.down_plant, edges.down_line,
      COALESCE(u.downtime_min, 0) AS upstream_downtime_min,
      COALESCE(s.starve_min, 0) AS downstream_starve_min
    FROM ${lineEdgesSql()}
    LEFT JOIN (
      SELECT plant, line, SUM(duration_ms) / 60000.0 AS downtime_min
      FROM ${downtime}
      WHERE category = 'UNPLANNED'
      GROUP BY 1, 2
    ) u ON u.plant = edges.up_plant AND u.line = edges.up_line
    LEFT JOIN (
      SELECT plant, line, SUM(duration_ms) / 60000.0 AS starve_min
      FROM ${downtime}
      WHERE reason_code = 'STARVE'
      GROUP BY 1, 2
    ) s ON s.plant = edges.down_plant AND s.line = edges.down_line
    ORDER BY upstream_downtime_min DESC
  `
}
