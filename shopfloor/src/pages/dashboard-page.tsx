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
  good_units: { label: "Gutteile", color: "var(--chart-2)" },
  scrap_units: { label: "Ausschuss", color: "var(--chart-5)" },
} satisfies ChartConfig

const fpyConfig = {
  fpy_pct: { label: "FPY %", color: "var(--chart-3)" },
} satisfies ChartConfig

const dtConfig = {
  minutes: { label: "Minuten", color: "var(--chart-4)" },
} satisfies ChartConfig

const histConfig = {
  cycles: { label: "Takte", color: "var(--chart-1)" },
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
          setLoadError(err instanceof Error ? err.message : "Übersichtsabfrage fehlgeschlagen")
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
        title="Noch keine Produktionsdaten"
        description="Demopaket laden oder XML aus der Freigabe ablegen."
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
        <h2 className="font-heading text-lg font-medium">Produktionsübersicht</h2>
        <p className="text-sm text-muted-foreground">
          Live-DuckDB-Kennzahlen für den aktuellen Filter.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Übersicht konnte nicht geladen werden</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Stück" value={formatNumber(units)} busy={busy} />
        <Kpi
          label="OEE"
          value={formatPct(oee.oee)}
          busy={busy}
          tone={oee.oee < 65 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Stillstand"
          value={formatMinutes(Number(kpis?.downtime_ms ?? 0))}
          busy={busy}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Offene Alarme"
          value={formatNumber(Number(kpis?.open_alarms ?? 0))}
          busy={busy}
          tone={Number(kpis?.open_alarms ?? 0) > 0 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi label="Verfügbarkeit" value={formatPct(oee.availability)} busy={busy} />
        <Kpi label="Leistung" value={formatPct(oee.performance)} busy={busy} />
        <Kpi
          label="Qualität"
          value={formatPct(oee.quality)}
          busy={busy}
          tone={fpy < 95 ? "bad" : "ok"}
          onClick={() => setView("triage")}
        />
        <Kpi
          label="Marge %"
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
            <CardTitle>Durchsatz</CardTitle>
            <CardDescription>Gutteile und Ausschuss je Stunde</CardDescription>
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
            <CardTitle>FPY je Linie</CardTitle>
            <CardDescription>Niedrigste Ausbeute zuerst</CardDescription>
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
            <CardTitle>Stillstand-Pareto</CardTitle>
            <CardDescription>Minuten nach Ursache</CardDescription>
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
            <CardTitle>Fehlercodes</CardTitle>
            <CardDescription>Klick öffnet Drill</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={fails}
              emptyLabel="Keine Fehlercodes in diesem Filter."
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
            <CardTitle>Taktzeit</CardTitle>
            <CardDescription>Anzahl je 1-s-Bucket</CardDescription>
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
            <CardTitle>Schicht × Linie</CardTitle>
            <CardDescription>FPY und Tempo der Schichten vergleichen</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable rows={compare} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Abhängige Linien</CardTitle>
            <CardDescription>
              Ungeplanter Stillstand vorne und STARVE-Minuten auf der nächsten
              Linie. Klick öffnet Preise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={deps}
              emptyLabel="Keine Zulaufkanten in diesem Filter."
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
