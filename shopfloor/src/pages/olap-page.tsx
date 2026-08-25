import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import { copyToClipboard } from "@/lib/download"
import {
  OLAP_DIMENSION_IDS,
  OLAP_MEASURE_IDS,
  olapCompatibleMeasures,
  olapCubeSql,
  olapDicePatch,
  sanitizeOlapDimensions,
  sanitizeOlapMeasures,
  type OlapDimensionId,
  type OlapMeasureId,
} from "@/lib/olap"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DataTable } from "@/components/data-table"
import { EmptyProduction } from "@/components/empty-production"
import { useFloorline } from "@/state/floorline-store"

const DIM_LABEL: Record<OlapDimensionId, string> = {
  plant: "Werk",
  line: "Linie",
  station: "Station",
  machine: "Maschine",
  shift: "Schicht",
  sku: "Artikel",
  result: "Ergebnis",
  hour: "Stunde",
}

const MEASURE_LABEL: Record<OlapMeasureId, string> = {
  cycles: "Takte",
  units: "Stück",
  good_units: "Gutteile",
  scrap_units: "Ausschuss",
  fpy_pct: "Erstausbeute %",
  avg_cycle_ms: "Mittl. Takt",
  downtime_min: "Stillstand Min",
  open_alarms: "Offene Alarme",
}

export function OlapPage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [dimensions, setDimensions] = useState<OlapDimensionId[]>([
    "plant",
    "line",
  ])
  const [measures, setMeasures] = useState<OlapMeasureId[]>([
    "cycles",
    "units",
    "fpy_pct",
    "downtime_min",
  ])
  const [rows, setRows] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const activeMeasures = useMemo(
    () => olapCompatibleMeasures(dimensions, measures),
    [dimensions, measures]
  )
  const sql = useMemo(
    () =>
      olapCubeSql({
        filters,
        dimensions,
        measures: activeMeasures,
      }),
    [activeMeasures, dimensions, filters]
  )
  const dropped = measures.filter((measure) => !activeMeasures.includes(measure))

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setLoadError(null)
    void queryRows(sql)
      .then((next) => {
        if (!cancelled) {
          setRows(next)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Würfelabfrage fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [ready, rowCounts.cycles, sql])

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="Kein Würfel zum Aggregieren"
        description="Produktionsdateien laden, dann nach Werk, Linie, Schicht oder Stunde schneiden."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Datenwürfel</h2>
        <p className="text-sm text-muted-foreground">
          DuckDB gruppiert den aktuellen Filter, den Schnitt. Dimensionen
          ergänzen den Drill. Klick auf eine Zeile würfelt die Werte in den
          Filter.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Würfel konnte nicht gebaut werden</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Körnung</CardTitle>
          <CardDescription>
            {dimensions.length === 0
              ? "Keine Dimensionen, eine Summe für den Schnitt."
              : `Gruppiert nach ${dimensions.map((id) => DIM_LABEL[id]).join(" → ")}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Dimensionen</FieldLabel>
            <ToggleGroup
              multiple
              value={dimensions}
              onValueChange={(values) =>
                setDimensions(sanitizeOlapDimensions(values))
              }
            >
              {OLAP_DIMENSION_IDS.map((id) => (
                <ToggleGroupItem key={id} value={id}>
                  {DIM_LABEL[id]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>Kennzahlen</FieldLabel>
            <ToggleGroup
              multiple
              value={measures}
              onValueChange={(values) =>
                setMeasures(sanitizeOlapMeasures(values))
              }
            >
              {OLAP_MEASURE_IDS.map((id) => (
                <ToggleGroupItem key={id} value={id}>
                  {MEASURE_LABEL[id]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          {dropped.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Auf dieser Körnung ausgeblendet:{" "}
              {dropped.map((id) => MEASURE_LABEL[id]).join(", ")}. Artikel und
              Ergebnis leben nur auf Takten.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Zellen</CardTitle>
          <CardDescription>
            {rows.length} Zeilen · Klick würfelt · Leiste bleibt der Schnitt
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={rows}
            maxHeight="28rem"
            emptyLabel="Keine Zellen für diesen Schnitt."
            onRowClick={(row) => {
              const patch = olapDicePatch(row)
              if (Object.keys(patch).length === 0) {
                return
              }
              patchFilters(patch)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void copyToClipboard(sql.trim()).then(() =>
                  toast.success("Würfel-SQL kopiert")
                )
              }}
            >
              SQL kopieren
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={dimensions.length === 0}
              onClick={() =>
                setDimensions(dimensions.slice(0, dimensions.length - 1))
              }
            >
              Letzte Dimension hochrollen
            </Button>
          </div>
          <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
            {sql.trim()}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
