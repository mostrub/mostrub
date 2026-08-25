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
          setLoadError(err instanceof Error ? err.message : "Triage-Abfrage fehlgeschlagen")
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
        title="Keine Takte zum Drill"
        description="Produktionsdateien laden, dann ein Werk anklicken, um eine Ebene tiefer zu gehen."
      />
    )
  }

  const selectedKey =
    nextColumn === "controller_id" ? filters.controllers[0] || undefined : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Drill und Triage</h2>
          <p className="text-sm text-muted-foreground">
            Klick auf eine Zeile geht eine Ebene tiefer. Verluste und Alarme
            folgen demselben Filter.
          </p>
          {loadError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Triage konnte nicht geladen werden</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {crumbs.length === 0 ? (
                <BreadcrumbPage>Alle Werke</BreadcrumbPage>
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
                  Alle Werke
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
          <CardTitle>Hierarchie</CardTitle>
          <CardDescription>
            Fehler zuerst. Ein Klick pinnt das nächste Werk, die Linie,
            Station, Maschine oder Steuerung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={tree}
            maxHeight="22rem"
            emptyLabel="Keine Zeilen in diesem Schnitt."
            selectedKey={selectedKey}
            rowKey={(row) => String(row[nextColumn] ?? "")}
            onRowClick={(row) => patchFilters(nextDrillPatch(filters, row))}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Längster Stillstand</CardTitle>
            <CardDescription>
              <Badge variant="outline">Ursache klicken filtert die Suche</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={downtime}
              emptyLabel="Kein Stillstand in diesem Schnitt."
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
            <CardTitle>Alarme</CardTitle>
            <CardDescription>Kritisch zuerst, dann offen</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={alarms}
              emptyLabel="Keine Alarme in diesem Schnitt."
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
            <CardTitle>Fehlercodes</CardTitle>
            <CardDescription>Qualitätsverluste im aktuellen Drill</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={fails}
              emptyLabel="Keine Fehlercodes in diesem Schnitt."
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
