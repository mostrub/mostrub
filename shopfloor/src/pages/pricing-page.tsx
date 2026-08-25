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
          setLoadError(err instanceof Error ? err.message : "Preisabfrage fehlgeschlagen")
        }
      })
    return () => {
      cancelled = true
    }
  }, [depSql, priceSql, ready, rowCounts.cycles])

  if (rowCounts.cycles === 0) {
    return (
      <EmptyProduction
        title="Keine Takte zum Kalkulieren"
        description="Batterieproduktion laden, dann nach Werk, Linie, Schicht oder SKU schneiden."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Batteriepreise</h2>
        <p className="text-sm text-muted-foreground">
          Listenpreis minus Material, Schichtlohn, Ausschussumlage und
          zugeteiltem Stillstand. Nachtschicht B hat einen Lohnaufschlag. Klick
          auf eine Zeile würfelt. Die Leiste bleibt der Schnitt.
        </p>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Dieser Schnitt ließ sich nicht kalkulieren</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Gewichtete Marge</CardDescription>
            <CardTitle className="font-mono text-xl">
              {formatPct(marginPct)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Preiszeilen</CardDescription>
            <CardTitle className="font-mono text-xl">{priced.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Schichtlohn</CardDescription>
            <CardTitle className="font-mono text-xl">
              A {formatMoney(SHIFT_LABOR_RATE.A)} / B{" "}
              {formatMoney(SHIFT_LABOR_RATE.B)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stückkosten nach SKU × Schicht × Linie</CardTitle>
          <CardDescription>
            Niedrigste Marge zuerst · Klick würfelt · Leiste bleibt der Schnitt
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={priced}
            maxHeight="28rem"
            emptyLabel="Keine Katalog-SKUs in diesem Schnitt."
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
                toast.success("Preis-SQL kopiert")
              )
            }}
          >
            SQL kopieren
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Abhängige Linien</CardTitle>
          <CardDescription>
            CELL-1 speist MOD-1 speist PACK-1. Ungeplanter Stillstand vorne
            hungert die nächste Linie aus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={deps}
            emptyLabel="Keine Linienkanten in diesem Schnitt."
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
            <CardTitle>Katalog</CardTitle>
            <CardDescription>Listenpreis und Materialkosten</CardDescription>
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
            <CardTitle>Liniengraph</CardTitle>
            <CardDescription>Zulauf → Abnahme</CardDescription>
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
