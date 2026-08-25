import {
  ALARM_SEVERITIES,
  CYCLE_RESULTS,
  DOWNTIME_CATEGORIES,
} from "@/lib/types"
import { toggleValue } from "@/lib/filters"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { useFloorline } from "@/state/floorline-store"

function OptionList(args: {
  legend: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  if (args.options.length === 0) {
    return null
  }
  return (
    <FieldSet>
      <FieldLegend variant="label">{args.legend}</FieldLegend>
      <FieldGroup className="gap-2">
        {args.options.map((option) => (
          <Field key={option} orientation="horizontal" className="items-center">
            <Checkbox
              checked={args.selected.includes(option)}
              onCheckedChange={() => args.onToggle(option)}
              id={`f-${args.legend}-${option}`}
            />
            <FieldLabel htmlFor={`f-${args.legend}-${option}`} className="font-mono text-xs">
              {option}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  )
}

export function FilterRail() {
  const { filters, facets, filterCount, patchFilters, clearFilters } = useFloorline()

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <p className="text-sm font-medium">Triage filters</p>
          <p className="text-xs text-muted-foreground">{filterCount} active</p>
        </div>
        <Button size="sm" variant="ghost" onClick={clearFilters}>
          Clear
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <Field>
            <FieldLabel htmlFor="search">Search</FieldLabel>
            <Input
              id="search"
              value={filters.search}
              placeholder="WO, serial, fault, IP…"
              onChange={(event) => patchFilters({ search: event.target.value })}
            />
          </Field>
          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel htmlFor="anomalies">Anomalies only</FieldLabel>
            <Switch
              id="anomalies"
              checked={filters.onlyAnomalies}
              onCheckedChange={(checked) =>
                patchFilters({ onlyAnomalies: Boolean(checked) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="from">From</FieldLabel>
            <Input
              id="from"
              type="datetime-local"
              value={toLocal(filters.from)}
              onChange={(event) =>
                patchFilters({ from: fromLocal(event.target.value) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="to">To</FieldLabel>
            <Input
              id="to"
              type="datetime-local"
              value={toLocal(filters.to)}
              onChange={(event) =>
                patchFilters({ to: fromLocal(event.target.value) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="min-cycle">Min cycle ms</FieldLabel>
            <Input
              id="min-cycle"
              type="number"
              value={filters.minCycleMs ?? ""}
              onChange={(event) =>
                patchFilters({
                  minCycleMs:
                    event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="max-cycle">Max cycle ms</FieldLabel>
            <Input
              id="max-cycle"
              type="number"
              value={filters.maxCycleMs ?? ""}
              onChange={(event) =>
                patchFilters({
                  maxCycleMs:
                    event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </Field>
          <OptionList
            legend="Plant"
            options={facets.plants}
            selected={filters.plants}
            onToggle={(value) =>
              patchFilters({ plants: toggleValue(filters.plants, value) })
            }
          />
          <OptionList
            legend="Line"
            options={facets.lines}
            selected={filters.lines}
            onToggle={(value) =>
              patchFilters({ lines: toggleValue(filters.lines, value) })
            }
          />
          <OptionList
            legend="Station"
            options={facets.stations}
            selected={filters.stations}
            onToggle={(value) =>
              patchFilters({ stations: toggleValue(filters.stations, value) })
            }
          />
          <OptionList
            legend="Machine"
            options={facets.machines}
            selected={filters.machines}
            onToggle={(value) =>
              patchFilters({ machines: toggleValue(filters.machines, value) })
            }
          />
          <OptionList
            legend="Controller"
            options={facets.controllers}
            selected={filters.controllers}
            onToggle={(value) =>
              patchFilters({
                controllers: toggleValue(filters.controllers, value),
              })
            }
          />
          <OptionList
            legend="Server"
            options={facets.servers}
            selected={filters.servers}
            onToggle={(value) =>
              patchFilters({ servers: toggleValue(filters.servers, value) })
            }
          />
          <OptionList
            legend="Shift"
            options={facets.shifts}
            selected={filters.shifts}
            onToggle={(value) =>
              patchFilters({ shifts: toggleValue(filters.shifts, value) })
            }
          />
          <OptionList
            legend="SKU"
            options={facets.skus}
            selected={filters.skus}
            onToggle={(value) =>
              patchFilters({ skus: toggleValue(filters.skus, value) })
            }
          />
          <OptionList
            legend="Work order"
            options={facets.workOrders}
            selected={filters.workOrders}
            onToggle={(value) =>
              patchFilters({
                workOrders: toggleValue(filters.workOrders, value),
              })
            }
          />
          <OptionList
            legend="Result"
            options={[...CYCLE_RESULTS]}
            selected={filters.results}
            onToggle={(value) => {
              if (value === "PASS" || value === "FAIL" || value === "REWORK") {
                patchFilters({ results: toggleValue(filters.results, value) })
              }
            }}
          />
          <OptionList
            legend="Alarm severity"
            options={[...ALARM_SEVERITIES]}
            selected={filters.severities}
            onToggle={(value) => {
              if (value === "INFO" || value === "WARN" || value === "CRITICAL") {
                patchFilters({
                  severities: toggleValue(filters.severities, value),
                })
              }
            }}
          />
          <OptionList
            legend="Downtime"
            options={[...DOWNTIME_CATEGORIES]}
            selected={filters.downtimeCategories}
            onToggle={(value) => {
              if (
                value === "PLANNED" ||
                value === "UNPLANNED" ||
                value === "CHANGEOVER"
              ) {
                patchFilters({
                  downtimeCategories: toggleValue(
                    filters.downtimeCategories,
                    value
                  ),
                })
              }
            }}
          />
        </div>
      </ScrollArea>
    </aside>
  )
}

function toLocal(iso: string | null): string {
  if (!iso) {
    return ""
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocal(value: string): string | null {
  if (value === "") {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}
