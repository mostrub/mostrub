import { Button } from "@/components/ui/button"
import { useFloorline } from "@/state/floorline-store"

function chip(
  label: string,
  values: string[],
  onClear: () => void
) {
  if (values.length === 0) {
    return null
  }
  return (
    <Button key={label} size="xs" variant="secondary" onClick={onClear}>
      {label}: {values.slice(0, 3).join(", ")}
      {values.length > 3 ? ` +${values.length - 3}` : ""}
    </Button>
  )
}

export function FilterChips() {
  const { filters, patchFilters, clearFilters, filterCount } = useFloorline()
  if (filterCount === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-4 py-1 print:hidden">
      {chip("Werk", filters.plants, () => patchFilters({ plants: [] }))}
      {chip("Linie", filters.lines, () => patchFilters({ lines: [] }))}
      {chip("Station", filters.stations, () => patchFilters({ stations: [] }))}
      {chip("Maschine", filters.machines, () => patchFilters({ machines: [] }))}
      {chip("Steuerung", filters.controllers, () =>
        patchFilters({ controllers: [] })
      )}
      {chip("Server", filters.servers, () => patchFilters({ servers: [] }))}
      {chip("Schicht", filters.shifts, () => patchFilters({ shifts: [] }))}
      {chip("SKU", filters.skus, () => patchFilters({ skus: [] }))}
      {chip("AO", filters.workOrders, () => patchFilters({ workOrders: [] }))}
      {chip("Ergebnis", filters.results, () => patchFilters({ results: [] }))}
      {chip("Stufe", filters.severities, () =>
        patchFilters({ severities: [] })
      )}
      {chip("Stillstand", filters.downtimeCategories, () =>
        patchFilters({ downtimeCategories: [] })
      )}
      {filters.from ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ from: null })}
        >
          Von {filters.from.slice(0, 16).replace("T", " ")}
        </Button>
      ) : null}
      {filters.to ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ to: null })}
        >
          Bis {filters.to.slice(0, 16).replace("T", " ")}
        </Button>
      ) : null}
      {filters.minCycleMs !== null ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ minCycleMs: null })}
        >
          Min. Takt {filters.minCycleMs} ms
        </Button>
      ) : null}
      {filters.maxCycleMs !== null ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ maxCycleMs: null })}
        >
          Max. Takt {filters.maxCycleMs} ms
        </Button>
      ) : null}
      {filters.search ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ search: "" })}
        >
          Suche: {filters.search}
        </Button>
      ) : null}
      {filters.onlyAnomalies ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ onlyAnomalies: false })}
        >
          Anomalien
        </Button>
      ) : null}
      <Button size="xs" variant="ghost" onClick={clearFilters}>
        Alles leeren
      </Button>
    </div>
  )
}
