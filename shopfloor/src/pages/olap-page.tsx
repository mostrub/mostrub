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
  plant: "Plant",
  line: "Line",
  station: "Station",
  machine: "Machine",
  shift: "Shift",
  sku: "SKU",
  result: "Result",
  hour: "Hour",
}

const MEASURE_LABEL: Record<OlapMeasureId, string> = {
  cycles: "Cycles",
  units: "Units",
  good_units: "Good",
  scrap_units: "Scrap",
  fpy_pct: "FPY %",
  avg_cycle_ms: "Avg cycle",
  downtime_min: "Downtime min",
  open_alarms: "Open alarms",
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
          setLoadError(err instanceof Error ? err.message : "OLAP query failed")
        }
      })
    return () => {
      cancelled = true
    }
  }, [ready, rowCounts.cycles, sql])

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="No cube to aggregate"
        description="Load production files, then slice by plant, line, shift, or hour."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">OLAP cube</h2>
        <p className="text-sm text-muted-foreground">
          DuckDB groups the current filter (the slice). Add dimensions to
          drill. Click a row to dice those values into the filter.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not build the cube</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Grain</CardTitle>
          <CardDescription>
            {dimensions.length === 0
              ? "No dimensions — one total row for the slice."
              : `Grouped by ${dimensions.map((id) => DIM_LABEL[id]).join(" → ")}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Dimensions</FieldLabel>
            <ToggleGroup
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
            <FieldLabel>Measures</FieldLabel>
            <ToggleGroup
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
              Hidden at this grain:{" "}
              {dropped.map((id) => MEASURE_LABEL[id]).join(", ")}. SKU and
              result live on cycles only.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cells</CardTitle>
          <CardDescription>
            {rows.length} rows · click to dice · rail stays the slice
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={rows}
            maxHeight="28rem"
            emptyLabel="No cells for this slice."
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
                  toast.success("Cube SQL copied")
                )
              }}
            >
              Copy SQL
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={dimensions.length === 0}
              onClick={() =>
                setDimensions(dimensions.slice(0, dimensions.length - 1))
              }
            >
              Roll up last
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
