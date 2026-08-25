import { useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { toggleValue } from "@/lib/filters"
import {
  controllersSql,
  serverLatestSql,
  serverSeriesSql,
} from "@/lib/queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

const seriesConfig = {
  cpu_pct: { label: "CPU %", color: "var(--chart-2)" },
  plc_scan_ms: { label: "SPS-Scan ms", color: "var(--chart-4)" },
  queue_depth: { label: "Warteschlange", color: "var(--chart-5)" },
} satisfies ChartConfig

export function ServersPage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [latest, setLatest] = useState<QueryRow[]>([])
  const [controllers, setControllers] = useState<QueryRow[]>([])
  const [series, setSeries] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const selected = filters.servers[0] ?? ""

  const hasServerData =
    rowCounts.server_samples > 0 || rowCounts.controllers > 0

  useEffect(() => {
    if (!ready || !hasServerData) {
      return
    }
    let cancelled = false
    setLoadError(null)
    Promise.all([
      queryRows(serverLatestSql(filters)),
      queryRows(controllersSql(filters)),
    ])
      .then(([serverRows, controllerRows]) => {
        if (cancelled) {
          return
        }
        setLatest(serverRows)
        setControllers(controllerRows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Serverabfrage fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, hasServerData, ready])

  useEffect(() => {
    if (!ready || selected === "") {
      setSeries([])
      return
    }
    let cancelled = false
    void queryRows(serverSeriesSql(filters, selected))
      .then((rows) => {
        if (!cancelled) {
          setSeries(rows)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Serverzeitreihe fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, ready, selected])

  if (ready && !hasServerData) {
    return (
      <EmptyProduction
        title="Noch keine Server oder Steuerungen"
        description="Produktions-XML laden, das ServerSample- oder Controller-Zeilen enthält."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">
          Serverprofile und Steuerungen
        </h2>
        <p className="text-sm text-muted-foreground">
          Neueste MES-, HMI-, Gateway- und Historienproben plus SPS-Scan,
          E/A-Fehler und Betriebsart. Server anklicken, um ihn zu pinnen und
          die Reihe zu zeichnen.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Server konnten nicht geladen werden</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Server</CardTitle>
          <CardDescription>
            {selected ? (
              <Badge>gewählt {selected}</Badge>
            ) : (
              "Kein Server gepinnt"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={latest}
            emptyLabel="Keine Serverproben in diesem Filter."
            selectedKey={selected || undefined}
            rowKey={(row) => String(row.server_id ?? "")}
            onRowClick={(row) =>
              patchFilters({
                servers: toggleValue([], String(row.server_id ?? "")),
                lines: toggleValue([], String(row.line ?? "")),
              })
            }
          />
        </CardContent>
      </Card>
      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Profil {selected}</CardTitle>
            <CardDescription>CPU, SPS-Scan und Warteschlange</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={seriesConfig} className="h-64 w-full">
              <AreaChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="sampled_at" hide />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="cpu_pct"
                  stroke="var(--color-cpu_pct)"
                  fill="var(--color-cpu_pct)"
                  fillOpacity={0.45}
                />
                <Area
                  dataKey="plc_scan_ms"
                  stroke="var(--color-plc_scan_ms)"
                  fill="var(--color-plc_scan_ms)"
                  fillOpacity={0.35}
                />
                <Area
                  dataKey="queue_depth"
                  stroke="var(--color-queue_depth)"
                  fill="var(--color-queue_depth)"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Steuerungen</CardTitle>
          <CardDescription>
            Hersteller, Firmware, Rack/Slot, Scan P95, E/A-Fehler, letzter Fehler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={controllers}
            emptyLabel="Keine Steuerungen in diesem Filter."
            selectedKey={filters.controllers[0] || undefined}
            rowKey={(row) => String(row.controller_id ?? "")}
            onRowClick={(row) =>
              patchFilters({
                controllers: toggleValue([], String(row.controller_id ?? "")),
                lines: toggleValue([], String(row.line ?? "")),
                stations: toggleValue([], String(row.station ?? "")),
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
