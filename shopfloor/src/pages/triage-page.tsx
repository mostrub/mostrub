import { useEffect, useMemo, useState } from "react"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import {
  clearDrillFrom,
  drillGroupColumns,
  nextDrillPatch,
  toggleValue,
} from "@/lib/filters"
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
import { EmptyProduction } from "@/components/empty-production"
import { useFloorline } from "@/state/floorline-store"

export function TriagePage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [tree, setTree] = useState<QueryRow[]>([])
  const [downtime, setDowntime] = useState<QueryRow[]>([])
  const [alarms, setAlarms] = useState<QueryRow[]>([])
  const [fails, setFails] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const dims = drillGroupColumns(filters)
  const nextColumn = dims[dims.length - 1] ?? "plant"

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
        clear: () => patchFilters(clearDrillFrom("line")),
      })
    }
    if (filters.lines[0]) {
      items.push({
        label: filters.lines[0],
        clear: () => patchFilters(clearDrillFrom("station")),
      })
    }
    if (filters.stations[0]) {
      items.push({
        label: filters.stations[0],
        clear: () => patchFilters(clearDrillFrom("machine")),
      })
    }
    if (filters.machines[0]) {
      items.push({
        label: filters.machines[0],
        clear: () => patchFilters(clearDrillFrom("controller")),
      })
    }
    if (filters.controllers[0]) {
      items.push({
        label: filters.controllers[0],
        clear: () => patchFilters(clearDrillFrom("controller")),
      })
    }
    return items
  }, [filters, patchFilters])

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="No cycles to drill"
        description="Load production files, then click a plant to go one level deeper."
      />
    )
  }

  const selectedKey =
    nextColumn === "controller_id" ? filters.controllers[0] || undefined : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Drill and triage</h2>
          <p className="text-sm text-muted-foreground">
            Click a row to go one level deeper. Losses and alarms follow the
            same filter.
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
              {crumbs.length === 0 ? (
                <BreadcrumbPage>All plants</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => patchFilters(clearDrillFrom("all"))}
                    />
                  }
                >
                  All plants
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
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
                  )}
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
            Defects first. One click pins the next plant, line, station,
            machine, or controller.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={tree}
            maxHeight="22rem"
            emptyLabel="No rows in this slice."
            selectedKey={selectedKey}
            rowKey={(row) => String(row[nextColumn] ?? "")}
            onRowClick={(row) => patchFilters(nextDrillPatch(filters, row))}
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
              emptyLabel="No downtime in this slice."
              selectedKey={filters.search || undefined}
              rowKey={(row) => String(row.reason_code ?? "")}
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
              emptyLabel="No alarms in this slice."
              selectedKey={filters.search || undefined}
              rowKey={(row) => String(row.code ?? "")}
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
              emptyLabel="No fail codes in this slice."
              selectedKey={filters.search || undefined}
              rowKey={(row) => String(row.fail_code ?? "")}
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
