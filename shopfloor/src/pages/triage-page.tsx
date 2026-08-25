import { useEffect, useMemo, useState } from "react"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { toggleValue } from "@/lib/filters"
import {
  failCodesSql,
  longDowntimeSql,
  openAlarmsSql,
  triageTreeSql,
} from "@/lib/queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { useFloorline } from "@/state/floorline-store"

export function TriagePage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [tree, setTree] = useState<QueryRow[]>([])
  const [downtime, setDowntime] = useState<QueryRow[]>([])
  const [alarms, setAlarms] = useState<QueryRow[]>([])
  const [fails, setFails] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setLoadError(null)
    Promise.all([
      queryRows(triageTreeSql(filters)),
      queryRows(longDowntimeSql(filters)),
      queryRows(openAlarmsSql(filters)),
      queryRows(failCodesSql(filters)),
    ])
      .then(([treeRows, dtRows, alarmRows, failRows]) => {
        if (cancelled) {
          return
        }
        setTree(treeRows)
        setDowntime(dtRows)
        setAlarms(alarmRows)
        setFails(failRows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Triage query failed")
        }
      })
    return () => {
      cancelled = true
    }
  }, [filters, ready, rowCounts.cycles])

  const crumbs = useMemo(() => {
    const items: { label: string; clear: () => void }[] = []
    if (filters.plants[0]) {
      items.push({
        label: filters.plants[0],
        clear: () => patchFilters({ plants: [] }),
      })
    }
    if (filters.lines[0]) {
      items.push({
        label: filters.lines[0],
        clear: () => patchFilters({ lines: [] }),
      })
    }
    if (filters.stations[0]) {
      items.push({
        label: filters.stations[0],
        clear: () => patchFilters({ stations: [] }),
      })
    }
    if (filters.machines[0]) {
      items.push({
        label: filters.machines[0],
        clear: () => patchFilters({ machines: [] }),
      })
    }
    if (filters.controllers[0]) {
      items.push({
        label: filters.controllers[0],
        clear: () => patchFilters({ controllers: [] }),
      })
    }
    return items
  }, [filters, patchFilters])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Drill and triage</h2>
          <p className="text-sm text-muted-foreground">
            Click a hierarchy row to pin plant → line → station → machine →
            controller. Losses and alarms follow the same filter.
          </p>
          {loadError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Could not load triage</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>All plants</BreadcrumbPage>
            </BreadcrumbItem>
            {crumbs.map((crumb) => (
              <span key={crumb.label} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={
                      <Button
                        variant="link"
                        size="sm"
                        onClick={crumb.clear}
                      />
                    }
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hierarchy</CardTitle>
          <CardDescription>
            Defects first. Click a row to drill. Shift-click a controller only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={tree}
            maxHeight="22rem"
            onRowClick={(row) => {
              patchFilters({
                plants: toggleValue([], String(row.plant ?? "")),
                lines: toggleValue([], String(row.line ?? "")),
                stations: toggleValue([], String(row.station ?? "")),
                machines: toggleValue([], String(row.machine ?? "")),
                controllers: toggleValue([], String(row.controller_id ?? "")),
              })
            }}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Longest downtime</CardTitle>
            <CardDescription>
              <Badge variant="outline">click reason to filter search</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={downtime}
              onRowClick={(row) =>
                patchFilters({ search: String(row.reason_code ?? "") })
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alarms</CardTitle>
            <CardDescription>Critical first, then open</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={alarms}
              onRowClick={(row) =>
                patchFilters({
                  controllers: toggleValue(
                    [],
                    String(row.controller_id ?? "")
                  ),
                  search: String(row.code ?? ""),
                })
              }
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Fail codes</CardTitle>
            <CardDescription>Quality losses in the current drill</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={fails}
              onRowClick={(row) =>
                patchFilters({
                  search: String(row.fail_code ?? ""),
                  results: ["FAIL"],
                })
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
