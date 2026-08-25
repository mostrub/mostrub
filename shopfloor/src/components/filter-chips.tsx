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
      {chip("Plant", filters.plants, () => patchFilters({ plants: [] }))}
      {chip("Line", filters.lines, () => patchFilters({ lines: [] }))}
      {chip("Station", filters.stations, () => patchFilters({ stations: [] }))}
      {chip("Machine", filters.machines, () => patchFilters({ machines: [] }))}
      {chip("Controller", filters.controllers, () =>
        patchFilters({ controllers: [] })
      )}
      {chip("Server", filters.servers, () => patchFilters({ servers: [] }))}
      {chip("Shift", filters.shifts, () => patchFilters({ shifts: [] }))}
      {chip("SKU", filters.skus, () => patchFilters({ skus: [] }))}
      {chip("WO", filters.workOrders, () => patchFilters({ workOrders: [] }))}
      {chip("Result", filters.results, () => patchFilters({ results: [] }))}
      {chip("Severity", filters.severities, () =>
        patchFilters({ severities: [] })
      )}
      {chip("Downtime", filters.downtimeCategories, () =>
        patchFilters({ downtimeCategories: [] })
      )}
      {filters.from ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ from: null })}
        >
          From {filters.from.slice(0, 16).replace("T", " ")}
        </Button>
      ) : null}
      {filters.to ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ to: null })}
        >
          To {filters.to.slice(0, 16).replace("T", " ")}
        </Button>
      ) : null}
      {filters.minCycleMs !== null ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ minCycleMs: null })}
        >
          Min cycle {filters.minCycleMs} ms
        </Button>
      ) : null}
      {filters.maxCycleMs !== null ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ maxCycleMs: null })}
        >
          Max cycle {filters.maxCycleMs} ms
        </Button>
      ) : null}
      {filters.search ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ search: "" })}
        >
          Search: {filters.search}
        </Button>
      ) : null}
      {filters.onlyAnomalies ? (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => patchFilters({ onlyAnomalies: false })}
        >
          Anomalies
        </Button>
      ) : null}
      <Button size="xs" variant="ghost" onClick={clearFilters}>
        Clear all
      </Button>
    </div>
  )
}
