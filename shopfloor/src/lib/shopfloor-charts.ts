export const ANDON_TONES = ["ok", "warn", "bad"] as const
export type AndonTone = (typeof ANDON_TONES)[number]

export type ParetoInput = {
  reason_code: string
  minutes: number
  events?: number
  category?: string
}

export type ParetoPoint = ParetoInput & {
  cumulative_pct: number
}

export type HeatCell = {
  line: string
  hour: string
  cycles: number
  fpy_pct: number
}

export type HeatGridModel = {
  lines: string[]
  hours: string[]
  cell: (line: string, hour: string) => HeatCell | null
}

export function andonTone(args: {
  fpyPct: number
  avgCycleMs: number
  targetCycleMs: number
}): AndonTone {
  const overTakt =
    args.targetCycleMs > 0 && args.avgCycleMs > args.targetCycleMs * 1.15
  if (args.fpyPct < 90 || overTakt) {
    return "bad"
  }
  if (args.fpyPct < 95) {
    return "warn"
  }
  return "ok"
}

export function andonFill(tone: AndonTone): string {
  switch (tone) {
    case "ok":
      return "var(--chart-2)"
    case "warn":
      return "var(--chart-3)"
    case "bad":
      return "var(--chart-5)"
    default: {
      const _never: never = tone
      return _never
    }
  }
}

export function paretoWithCumulative(rows: ParetoInput[]): ParetoPoint[] {
  const ordered = [...rows].sort((a, b) => b.minutes - a.minutes)
  const total = ordered.reduce((sum, row) => sum + row.minutes, 0)
  let seen = 0
  return ordered.map((row) => {
    seen += row.minutes
    return {
      ...row,
      cumulative_pct: total === 0 ? 0 : (100 * seen) / total,
    }
  })
}

export function heatFill(fpyPct: number): string {
  if (fpyPct >= 95) {
    return "var(--chart-2)"
  }
  if (fpyPct >= 90) {
    return "var(--chart-3)"
  }
  if (fpyPct >= 80) {
    return "var(--chart-4)"
  }
  return "var(--chart-5)"
}

export function buildHeatGrid(rows: HeatCell[]): HeatGridModel {
  const lines = [...new Set(rows.map((row) => row.line))].sort((a, b) =>
    a.localeCompare(b)
  )
  const hours = [...new Set(rows.map((row) => row.hour))].sort((a, b) =>
    a.localeCompare(b)
  )
  const index = new Map<string, HeatCell>()
  for (const row of rows) {
    index.set(`${row.line}|${row.hour}`, row)
  }
  return {
    lines,
    hours,
    cell: (line, hour) => index.get(`${line}|${hour}`) ?? null,
  }
}
