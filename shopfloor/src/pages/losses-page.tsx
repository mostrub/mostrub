import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { LINE_EDGES, dependentLineDicePatch, dependentLineSql, stationDicePatch } from "@/lib/battery"
import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { formatNumber, formatPct } from "@/lib/format"
import { computeOee, oeeLossMinutes } from "@/lib/oee"
import {
  downtimeByStationSql,
  failCodesSql,
  oeeSql,
  stationBottleneckSql,
} from "@/lib/queries"
import { paretoWithCumulative } from "@/lib/shopfloor-charts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DataTable } from "@/components/data-table"
import { EmptyProduction } from "@/components/empty-production"
import { useFloorline } from "@/state/floorline-store"

const lossConfig = {
  minutes: { label: "Minuten", color: "var(--chart-4)" },
} satisfies ChartConfig

const failConfig = {
  hits: { label: "Treffer", color: "var(--chart-5)" },
} satisfies ChartConfig

export function LossesPage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [oeeRow, setOeeRow] = useState<QueryRow | null>(null)
  const [stations, setStations] = useState<QueryRow[]>([])
  const [stationDt, setStationDt] = useState<QueryRow[]>([])
  const [fails, setFails] = useState<QueryRow[]>([])
  const [deps, setDeps] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setLoadError(null)
    Promise.all([
      queryRows(oeeSql(filters)),
      queryRows(stationBottleneckSql(filters)),
      queryRows(downtimeByStationSql(filters)),
      queryRows(failCodesSql(filters)),
      queryRows(dependentLineSql(filters)),
    ])
      .then(([oeeRows, stationRows, dtRows, failRows, depRows]) => {
        if (cancelled) {
          return
        }
        setOeeRow(oeeRows[0] ?? null)
        setStations(stationRows)
        setStationDt(dtRows)
        setFails(failRows)
        setDeps(depRows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Verlustabfrage fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, ready, rowCounts.cycles])

  const oee = computeOee({
    windowMs: Number(oeeRow?.window_ms ?? 0),
    unplannedDowntimeMs: Number(oeeRow?.unplanned_ms ?? 0),
    units: Number(oeeRow?.units ?? 0),
    goodUnits: Number(oeeRow?.good_units ?? 0),
    targetCycleMs: Number(oeeRow?.target_cycle_ms ?? 0),
    idealMs: Number(oeeRow?.ideal_ms ?? 0),
  })
  const losses = useMemo(
    () =>
      oeeLossMinutes({
        windowMs: Number(oeeRow?.window_ms ?? 0),
        unplannedDowntimeMs: Number(oeeRow?.unplanned_ms ?? 0),
        idealMs: Number(oeeRow?.ideal_ms ?? 0),
        quality: oee.quality,
      }),
    [oee.quality, oeeRow]
  )
  const failPareto = useMemo(
    () =>
      paretoWithCumulative(
        fails.map((row) => ({
          reason_code: String(row.fail_code ?? ""),
          minutes: Number(row.hits ?? 0),
        }))
      ).map((row) => ({
        fail_code: row.reason_code,
        hits: row.minutes,
        cumulative_pct: row.cumulative_pct,
      })),
    [fails]
  )
  const starveMin = deps.reduce(
    (sum, row) => sum + Number(row.downstream_starve_min ?? 0),
    0
  )
  const lossTotal = losses.reduce((sum, row) => sum + row.minutes, 0)

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="Keine Takte für Verluste"
        description="Produktion laden, dann nach Linie oder Station schneiden."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Verluste und Engpässe</h2>
        <p className="text-sm text-muted-foreground">
          Wo die Schicht Zeit verliert: Stillstand, zu langsamer Takt,
          Ausschuss, und Hunger auf der nächsten Linie. Klick würfelt.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Verluste konnten nicht geladen werden</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Verlustminuten</CardDescription>
            <CardTitle className="font-mono text-xl">
              {formatNumber(lossTotal, 1)} Min
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Hunger hinten</CardDescription>
            <CardTitle className="font-mono text-xl">
              {formatNumber(starveMin, 1)} Min
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>OEE</CardDescription>
            <CardTitle className="font-mono text-xl">{formatPct(oee.oee)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>OEE-Verlustminuten</CardTitle>
            <CardDescription>
              Verfügbarkeit = ungeplanter Stillstand. Leistung = Laufzeit minus
              Idealzeit. Qualität = Idealzeit × Ausschussanteil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lossConfig} className="h-56 w-full">
              <BarChart data={losses} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fehler-Pareto</CardTitle>
            <CardDescription>Treffer nach Fehlercode. Klick öffnet Drill.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={failConfig} className="h-56 w-full">
              <BarChart data={failPareto}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="fail_code" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hits" fill="var(--color-hits)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stationsengpass</CardTitle>
            <CardDescription>
              Takt über Soll zuerst. Klick pinnt Werk, Linie und Station.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={stations}
              emptyLabel="Keine Stationen in diesem Filter."
              onRowClick={(row) => {
                const patch = stationDicePatch(row)
                if (Object.keys(patch).length > 0) {
                  patchFilters(patch)
                }
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stillstand je Station</CardTitle>
            <CardDescription>Minuten nach Kategorie</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={stationDt}
              emptyLabel="Kein Stillstand in diesem Filter."
              onRowClick={(row) => {
                const patch = stationDicePatch(row)
                if (Object.keys(patch).length > 0) {
                  patchFilters(patch)
                }
              }}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Zulauf und Aushungern</CardTitle>
            <CardDescription>
              CELL-1 speist MOD-1 speist PACK-1. Ungeplanter Stillstand vorne
              und Hunger-Minuten hinten.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {LINE_EDGES.map((edge) => (
                <span
                  key={`${edge.upstreamLine}-${edge.downstreamLine}`}
                  className="rounded-lg border px-2 py-1"
                >
                  {edge.upstreamLine} → {edge.downstreamLine}
                </span>
              ))}
            </div>
            <DataTable
              rows={deps}
              emptyLabel="Keine Zulaufkanten in diesem Schnitt."
              onRowClick={(row) => {
                const patch = dependentLineDicePatch(row)
                if (Object.keys(patch).length > 0) {
                  patchFilters(patch)
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
