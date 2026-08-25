import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { formatMinutes, formatNumber, formatPct } from "@/lib/format"
import {
  downtimeParetoSql,
  failCodesSql,
  fpyByLineSql,
  hourlyThroughputSql,
  kpiSql,
} from "@/lib/queries"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { useFloorline } from "@/state/floorline-store"

const throughputConfig = {
  good_units: { label: "Good", color: "var(--chart-2)" },
  scrap_units: { label: "Scrap", color: "var(--chart-5)" },
} satisfies ChartConfig

const fpyConfig = {
  fpy_pct: { label: "FPY %", color: "var(--chart-3)" },
} satisfies ChartConfig

const dtConfig = {
  minutes: { label: "Minutes", color: "var(--chart-4)" },
} satisfies ChartConfig

export function DashboardPage() {
  const { filters, rowCounts, ready } = useFloorline()
  const [kpis, setKpis] = useState<QueryRow | null>(null)
  const [hourly, setHourly] = useState<QueryRow[]>([])
  const [lines, setLines] = useState<QueryRow[]>([])
  const [pareto, setPareto] = useState<QueryRow[]>([])
  const [fails, setFails] = useState<QueryRow[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setBusy(true)
    Promise.all([
      queryRows(kpiSql(filters)),
      queryRows(hourlyThroughputSql(filters)),
      queryRows(fpyByLineSql(filters)),
      queryRows(downtimeParetoSql(filters)),
      queryRows(failCodesSql(filters)),
    ])
      .then(([kpiRows, hourRows, lineRows, dtRows, failRows]) => {
        if (cancelled) {
          return
        }
        setKpis(kpiRows[0] ?? null)
        setHourly(hourRows)
        setLines(lineRows)
        setPareto(dtRows)
        setFails(failRows)
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, ready, rowCounts.cycles])

  if (rowCounts.cycles === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No production data yet</EmptyTitle>
          <EmptyDescription>
            Ingest XML from a share, or load the demo production pack.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const units = Number(kpis?.units ?? 0)
  const good = Number(kpis?.good_units ?? 0)
  const fpy = units === 0 ? 0 : (100 * good) / units
  const pace =
    Number(kpis?.avg_target_ms ?? 0) === 0
      ? 0
      : (100 * Number(kpis?.avg_target_ms ?? 0)) / Number(kpis?.avg_cycle_ms ?? 1)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Production dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Live DuckDB aggregates for the current filter set.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Units" value={formatNumber(units)} busy={busy} />
        <Kpi label="FPY" value={formatPct(fpy)} busy={busy} tone={fpy < 95 ? "bad" : "ok"} />
        <Kpi label="Pace vs target" value={formatPct(pace)} busy={busy} />
        <Kpi
          label="Downtime"
          value={formatMinutes(Number(kpis?.downtime_ms ?? 0))}
          busy={busy}
        />
        <Kpi
          label="Critical / open alarms"
          value={`${formatNumber(Number(kpis?.critical_alarms ?? 0))} / ${formatNumber(Number(kpis?.open_alarms ?? 0))}`}
          busy={busy}
          tone={Number(kpis?.open_alarms ?? 0) > 0 ? "bad" : "ok"}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <CardDescription>Good vs scrap by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={throughputConfig} className="h-56 w-full">
              <BarChart data={hourly}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="good_units" fill="var(--color-good_units)" radius={3} />
                <Bar dataKey="scrap_units" fill="var(--color-scrap_units)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>FPY by line</CardTitle>
            <CardDescription>Lowest yield first</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={fpyConfig} className="h-56 w-full">
              <LineChart data={lines}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="line" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[80, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="fpy_pct" stroke="var(--color-fpy_pct)" dot />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Downtime Pareto</CardTitle>
            <CardDescription>Minutes by reason code</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dtConfig} className="h-56 w-full">
              <BarChart data={pareto}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="reason_code" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fail codes</CardTitle>
            <CardDescription>Click a row in triage to drill</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable rows={fails} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Kpi(args: {
  label: string
  value: string
  busy: boolean
  tone?: "ok" | "bad"
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{args.label}</CardDescription>
        <CardTitle className="font-mono text-xl">
          {args.busy ? <Skeleton className="h-7 w-20" /> : args.value}
        </CardTitle>
      </CardHeader>
      {args.tone === "bad" ? (
        <CardContent>
          <Badge variant="destructive">needs triage</Badge>
        </CardContent>
      ) : null}
    </Card>
  )
}
