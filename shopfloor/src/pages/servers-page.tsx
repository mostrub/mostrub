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
  plc_scan_ms: { label: "PLC scan ms", color: "var(--chart-4)" },
  queue_depth: { label: "Queue", color: "var(--chart-5)" },
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
          setLoadError(err instanceof Error ? err.message : "Server query failed")
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
          setLoadError(err instanceof Error ? err.message : "Server series query failed")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, ready, selected])

  if (ready && !hasServerData) {
    return (
      <EmptyProduction
        title="No servers or controllers yet"
        description="Load production XML that includes ServerSample or Controller rows."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">
          Server profiling and controllers
        </h2>
        <p className="text-sm text-muted-foreground">
          Latest MES / HMI / gateway / historian samples plus PLC scan, I/O
          faults, and run mode. Click a server to pin it and plot the series.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load servers</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <CardDescription>
            {selected ? (
              <Badge>selected {selected}</Badge>
            ) : (
              "No server pinned"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={latest}
            emptyLabel="No server samples in this filter."
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
            <CardTitle>Profile {selected}</CardTitle>
            <CardDescription>CPU, PLC scan, and queue depth</CardDescription>
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
                  fillOpacity={0.15}
                />
                <Area
                  dataKey="plc_scan_ms"
                  stroke="var(--color-plc_scan_ms)"
                  fill="var(--color-plc_scan_ms)"
                  fillOpacity={0.1}
                />
                <Area
                  dataKey="queue_depth"
                  stroke="var(--color-queue_depth)"
                  fill="var(--color-queue_depth)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Controllers</CardTitle>
          <CardDescription>
            Vendor, firmware, rack/slot, scan P95, I/O faults, last fault
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={controllers}
            emptyLabel="No controllers in this filter."
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
