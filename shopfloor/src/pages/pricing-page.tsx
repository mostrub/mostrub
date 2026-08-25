import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { QueryRow } from "@/lib/duckdb/engine"
import { queryRows } from "@/lib/duckdb/engine"
import {
  BATTERY_SKUS,
  LINE_EDGES,
  SHIFT_LABOR_RATE,
  dependentLineDicePatch,
  dependentLineSql,
  pricingDicePatch,
  pricingSql,
  weightedMarginPct,
} from "@/lib/battery"
import { copyToClipboard } from "@/lib/download"
import { formatMoney, formatPct } from "@/lib/format"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

export function PricingPage() {
  const { filters, patchFilters, rowCounts, ready } = useFloorline()
  const [priced, setPriced] = useState<QueryRow[]>([])
  const [deps, setDeps] = useState<QueryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const priceSql = useMemo(() => pricingSql(filters), [filters])
  const depSql = useMemo(() => dependentLineSql(filters), [filters])
  const marginPct = weightedMarginPct(priced)

  useEffect(() => {
    if (!ready || rowCounts.cycles === 0) {
      return
    }
    let cancelled = false
    setLoadError(null)
    Promise.all([queryRows(priceSql), queryRows(depSql)])
      .then(([priceRows, depRows]) => {
        if (cancelled) {
          return
        }
        setPriced(priceRows)
        setDeps(depRows)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Pricing query failed")
        }
      })
    return () => {
      cancelled = true
    }
  }, [depSql, priceSql, ready, rowCounts.cycles])

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="No cycles to price"
        description="Load battery production files, then slice by plant, line, shift, or SKU."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Battery pricing</h2>
        <p className="text-sm text-muted-foreground">
          Catalog list price minus material, shift labor, scrap spread, and
          allocated downtime. Night shift B is a labor premium. Click a row to
          dice. The rail stays the slice.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not price this slice</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Weighted margin</CardDescription>
            <CardTitle className="font-mono text-xl">
              {formatPct(marginPct)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Priced grains</CardDescription>
            <CardTitle className="font-mono text-xl">{priced.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Shift labor</CardDescription>
            <CardTitle className="font-mono text-xl">
              A {formatMoney(SHIFT_LABOR_RATE.A)} / B{" "}
              {formatMoney(SHIFT_LABOR_RATE.B)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Unit cost by SKU × shift × line</CardTitle>
          <CardDescription>
            Lowest margin first · click to dice · rail stays the slice
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={priced}
            maxHeight="28rem"
            emptyLabel="No catalog SKUs in this slice."
            onRowClick={(row) => {
              const patch = pricingDicePatch(row)
              if (Object.keys(patch).length === 0) {
                return
              }
              patchFilters(patch)
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void copyToClipboard(priceSql.trim()).then(() =>
                toast.success("Pricing SQL copied")
              )
            }}
          >
            Copy SQL
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dependent lines</CardTitle>
          <CardDescription>
            CELL-1 feeds MOD-1 feeds PACK-1. Upstream unplanned downtime
            starves the next line.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={deps}
            emptyLabel="No line edges for this slice."
            onRowClick={(row) => {
              const patch = dependentLineDicePatch(row)
              if (Object.keys(patch).length === 0) {
                return
              }
              patchFilters(patch)
            }}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>List price and material cost</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={BATTERY_SKUS.map((sku) => ({
                sku: sku.sku,
                name: sku.name,
                list_price: sku.listPrice,
                material_cost: sku.materialCost,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Line graph</CardTitle>
            <CardDescription>Feeder → dependent</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={LINE_EDGES.map((edge) => ({
                upstream: `${edge.upstreamPlant} ${edge.upstreamLine}`,
                downstream: `${edge.downstreamPlant} ${edge.downstreamLine}`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
