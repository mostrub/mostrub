import { useEffect, useState, type KeyboardEvent } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  dependentLineDicePatch,
  dependentLineSql,
  pricingSql,
  weightedMarginPct,
} from "@/lib/battery"
import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { formatMinutes, formatNumber, formatPct } from "@/lib/format"
import { computeOee } from "@/lib/oee"
import {
  cycleHistogramSql,
  downtimeParetoSql,
  failCodesSql,
  fpyByLineSql,
  hourlyThroughputSql,
  kpiSql,
  oeeSql,
  shiftCompareSql,
} from "@/lib/queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { EmptyProduction } from "@/components/empty-production"
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

const histConfig = {
  cycles: { label: "Cycles", color: "var(--chart-1)" },
} satisfies ChartConfig

export function DashboardPage() {
  const { filters, rowCounts, ready, patchFilters, setView } = useFloorline()
  const [kpis, setKpis] = useState<QueryRow | null>(null)
  const [hourly, setHourly] = useState<QueryRow[]>([])
  const [lines, setLines] = useState<QueryRow[]>([])
  const [pareto, setPareto] = useState<QueryRow[]>([])
  const [fails, setFails] = useState<QueryRow[]>([])
  const [hist, setHist] = useState<QueryRow[]>([])
  const [compare, setCompare] = useState<QueryRow[]>([])
  const [priced, setPriced] = useState<QueryRow[]>([])
  const [deps, setDeps] = useState<QueryRow[]>([])
  const [oee, setOee] = useState(computeOee({
    windowMs: 0,
    unplannedDowntimeMs: 0,
    units: 0,
    goodUnits: 0,
    targetCycleMs: 0,
  }))
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setBusy(true)
    setLoadError(null)
    Promise.all([
      queryRows(kpiSql(filters)),
      queryRows(hourlyThroughputSql(filters)),
      queryRows(fpyByLineSql(filters)),
      queryRows(downtimeParetoSql(filters)),
      queryRows(failCodesSql(filters)),
      queryRows(oeeSql(filters)),
      queryRows(cycleHistogramSql(filters)),
      queryRows(shiftCompareSql(filters)),
      queryRows(pricingSql(filters)),
      queryRows(dependentLineSql(filters)),
    ])
      .then(([
        kpiRows,
        hourRows,
        lineRows,
        dtRows,
        failRows,
        oeeRows,
        histRows,
        compareRows,
        priceRows,
        depRows,
      ]) => {
        if (cancelled) {
          return
        }
        setKpis(kpiRows[0] ?? null)
        setHourly(hourRows)
        setLines(lineRows)
        setPareto(dtRows)
        setFails(failRows)
        setHist(histRows)
        setCompare(compareRows)
        setPriced(priceRows)
        setDeps(depRows)
        const oeeRow = oeeRows[0]
        setOee(
          computeOee({
            windowMs: Number(oeeRow?.window_ms ?? 0),
            unplannedDowntimeMs: Number(oeeRow?.unplanned_ms ?? 0),
            units: Number(oeeRow?.units ?? 0),
            goodUnits: Number(oeeRow?.good_units ?? 0),
            targetCycleMs: Number(oeeRow?.target_cycle_ms ?? 0),
            idealMs: Number(oeeRow?.ideal_ms ?? 0),
          })
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Dashboard query failed")
        }
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
      <EmptyProduction
        title="No production data yet"
        description="Load the demo pack or drop XML from the share."
      />
    )
  }

  const units = Number(kpis?.units ?? 0)
  const good = Number(kpis?.good_units ?? 0)
  const fpy = units === 0 ? 0 : (100 * good) / units
  const marginPct = weightedMarginPct(priced)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Production dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Live DuckDB aggregates for the current filter set.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the dashboard</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Units" value={formatNumber(units)} busy={busy} />
        <Kpi
          label="OEE"
          value={formatPct(oee.oee)}
          busy={busy}
          tone={oee.oee < 65 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Downtime"
          value={formatMinutes(Number(kpis?.downtime_ms ?? 0))}
          busy={busy}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Open alarms"
          value={formatNumber(Number(kpis?.open_alarms ?? 0))}
          busy={busy}
          tone={Number(kpis?.open_alarms ?? 0) > 0 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi label="Availability" value={formatPct(oee.availability)} busy={busy} />
        <Kpi label="Performance" value={formatPct(oee.performance)} busy={busy} />
        <Kpi
          label="Quality"
          value={formatPct(oee.quality)}
          busy={busy}
          tone={fpy < 95 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Margin %"
          value={formatPct(marginPct)}
          busy={busy}
          tone={marginPct < 35 ? "bad" : "ok"}
          onClick={() => setView("pricing")}
        />
      </div>
      )}
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
                <YAxis tickLine={false} axisLine={false} />
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
            <CardDescription>Click a fail code to open Drill</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={fails}
              emptyLabel="No fail codes in this filter."
              onRowClick={(row) => {
                patchFilters({
                  search: String(row.fail_code ?? ""),
                  results: ["FAIL"],
                })
                setView("triage")
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cycle time</CardTitle>
            <CardDescription>Counts by 1s bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={histConfig} className="h-56 w-full">
              <BarChart data={hist}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket_ms" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cycles" fill="var(--color-cycles)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shift × line</CardTitle>
            <CardDescription>Compare FPY and pace across crews</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable rows={compare} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dependent lines</CardTitle>
            <CardDescription>
              Upstream unplanned downtime and STARVE minutes on the next line.
              Click a row to open Pricing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={deps}
              emptyLabel="No feeder edges in this filter."
              onRowClick={(row) => {
                const patch = dependentLineDicePatch(row)
                if (Object.keys(patch).length > 0) {
                  patchFilters(patch)
                }
                setView("pricing")
              }}
            />
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
  onClick?: () => void
}) {
  return (
    <Card
      size="sm"
      className={args.onClick ? "cursor-pointer" : undefined}
      tabIndex={args.onClick ? 0 : undefined}
      role={args.onClick ? "button" : undefined}
      onClick={args.onClick}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!args.onClick) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          args.onClick()
        }
      }}
    >
      <CardHeader>
        <CardDescription>{args.label}</CardDescription>
        <CardTitle
          className={
            args.tone === "bad"
              ? "font-mono text-xl text-destructive"
              : "font-mono text-xl"
          }
        >
          {args.busy ? <Skeleton className="h-7 w-20" /> : args.value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
