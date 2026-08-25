import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  dependentLineDicePatch,
  dependentLineSql,
} from "@/lib/battery"
import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { formatMinutes, formatNumber, formatPct } from "@/lib/format"
import { valueLabel } from "@/lib/labels"
import { computeOee } from "@/lib/oee"
import {
  cycleHistogramSql,
  downtimeParetoSql,
  failCodesSql,
  fpyByLineSql,
  hourlyThroughputSql,
  kpiSql,
  lineHourHeatSql,
  oeeSql,
  shiftCompareSql,
} from "@/lib/queries"
import { paretoWithCumulative, type HeatCell } from "@/lib/shopfloor-charts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { AndonBoard } from "@/components/andon-board"
import { EmptyProduction } from "@/components/empty-production"
import { HeatGrid } from "@/components/heat-grid"
import { OeeRings } from "@/components/oee-rings"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/data-table"
import { useFloorline } from "@/state/floorline-store"

const throughputConfig = {
  good_units: { label: "Gutteile", color: "var(--chart-2)" },
  rework_units: { label: "Nacharbeit", color: "var(--chart-3)" },
  scrap_units: { label: "Ausschuss", color: "var(--chart-5)" },
} satisfies ChartConfig

const dtConfig = {
  minutes: { label: "Minuten", color: "var(--chart-4)" },
  cumulative_pct: { label: "Kumuliert %", color: "var(--chart-1)" },
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
  const [deps, setDeps] = useState<QueryRow[]>([])
  const [heat, setHeat] = useState<HeatCell[]>([])
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
      queryRows(dependentLineSql(filters)),
      queryRows(lineHourHeatSql(filters)),
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
        depRows,
        heatRows,
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
        setDeps(depRows)
        setHeat(
          heatRows.map((row) => ({
            line: String(row.line ?? ""),
            hour: String(row.hour ?? "").padStart(2, "0"),
            cycles: Number(row.cycles ?? 0),
            fpy_pct: Number(row.fpy_pct ?? 0),
          }))
        )
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

  const paretoPoints = useMemo(
    () =>
      paretoWithCumulative(
        pareto.map((row) => ({
          reason_code: String(row.reason_code ?? ""),
          minutes: Number(row.minutes ?? 0),
          events: Number(row.events ?? 0),
          category: String(row.category ?? ""),
        }))
      ),
    [pareto]
  )

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="Noch keine Produktionsdaten"
        description="Demopaket laden oder XML aus der Freigabe ablegen."
      />
    )
  }

  const pickLine = (line: string) => {
    patchFilters({ lines: [line] })
    setView("triage")
  }
  const targetBucketMs = Math.round(Number(kpis?.avg_target_ms ?? 0) / 1000) * 1000

  const units = Number(kpis?.units ?? 0)
  const good = Number(kpis?.good_units ?? 0)
  const fpy = units === 0 ? 0 : (100 * good) / units

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
          label="Hunger"
          value={formatMinutes(Number(kpis?.starve_ms ?? 0))}
          busy={busy}
          tone={Number(kpis?.starve_ms ?? 0) > 0 ? "bad" : "ok"}
          onClick={() => setView("losses")}
        />
      </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Andon · Linienstatus</CardTitle>
          <CardDescription>
            Grün läuft, Gelb Grenzbereich, Rot Erstausbeute unter 90 % oder Takt über
            Soll. Klick öffnet Drill.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AndonBoard rows={lines} onPick={pickLine} />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>OEE-Zerlegung</CardTitle>
            <CardDescription>
              Ringe für Verfügbarkeit, Leistung und Qualität. Mitte ist OEE.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OeeRings oee={oee} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Durchsatzmix</CardTitle>
            <CardDescription>Gutteile, Nacharbeit und Ausschuss je Stunde</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={throughputConfig} className="h-56 w-full">
              <AreaChart data={hourly}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="good_units"
                  stackId="mix"
                  stroke="var(--color-good_units)"
                  fill="var(--color-good_units)"
                  fillOpacity={1}
                />
                <Area
                  type="monotone"
                  dataKey="rework_units"
                  stackId="mix"
                  stroke="var(--color-rework_units)"
                  fill="var(--color-rework_units)"
                  fillOpacity={1}
                />
                <Area
                  type="monotone"
                  dataKey="scrap_units"
                  stackId="mix"
                  stroke="var(--color-scrap_units)"
                  fill="var(--color-scrap_units)"
                  fillOpacity={1}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stillstand-Pareto</CardTitle>
            <CardDescription>Minuten nach Ursache, Linie ist kumuliert %</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dtConfig} className="h-56 w-full">
              <ComposedChart data={paretoPoints}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="reason_code"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => valueLabel(String(value))}
                />
                <YAxis tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="cum"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulative_pct"
                  stroke="var(--color-cumulative_pct)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Takt gegen Soll</CardTitle>
            <CardDescription>
              Anzahl je 1-s-Intervall. Senkrechte Linie ist der mittlere Soll-Takt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={histConfig} className="h-56 w-full">
              <ComposedChart data={hist}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket_ms" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cycles" fill="var(--color-cycles)" radius={3} />
                {targetBucketMs > 0 ? (
                  <ReferenceLine
                    x={targetBucketMs}
                    stroke="var(--chart-3)"
                    strokeDasharray="4 3"
                    label={{ value: "Soll", fill: "var(--chart-3)", fontSize: 11 }}
                  />
                ) : null}
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Stunde × Linie</CardTitle>
            <CardDescription>
              Andon-Heatmap der Erstausbeute. Grün ab 95 %, Gelb ab 90 %, Rot darunter.
              Klick filtert die Linie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeatGrid rows={heat} onPickLine={pickLine} />
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
            <CardTitle>Schicht × Linie</CardTitle>
            <CardDescription>
              Erstausbeute und Tempo der Schichten vergleichen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable rows={compare} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Abhängige Linien</CardTitle>
            <CardDescription>
              Ungeplanter Stillstand vorne und Hunger-Minuten auf der nächsten
              Linie. Klick öffnet Verluste.
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
                setView("losses")
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
