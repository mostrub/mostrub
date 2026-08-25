import {
  ALARM_SEVERITIES,
  CYCLE_RESULTS,
  DOWNTIME_CATEGORIES,
} from "@/lib/types"
import { useState } from "react"
import { finiteOrNull, toggleValue } from "@/lib/filters"
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
  limit?: number
}) {
  if (args.options.length === 0) {
    return null
  }
  const limit = args.limit ?? 16
  const visible = args.options.slice(0, limit)
  const hidden = args.options.length - visible.length
  return (
    <FieldSet>
      <FieldLegend variant="label">{args.legend}</FieldLegend>
      <FieldGroup className="gap-2">
        {visible.map((option) => (
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
        {hidden > 0 ? (
          <p className="text-xs text-muted-foreground">
            {hidden} weitere. Suche für den Rest.
          </p>
        ) : null}
      </FieldGroup>
    </FieldSet>
  )
}

export function FilterRail() {
  const {
    filters,
    facets,
    filterCount,
    patchFilters,
    clearFilters,
    presets,
    saveCurrentPreset,
    applyPreset,
    deletePreset,
  } = useFloorline()
  const [presetName, setPresetName] = useState("")

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <p className="text-sm font-medium">Triage-Filter</p>
          <p className="text-xs text-muted-foreground">{filterCount} aktiv</p>
        </div>
        <Button size="sm" variant="ghost" onClick={clearFilters}>
          Leeren
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <FieldSet>
            <FieldLegend variant="label">Vorlagen</FieldLegend>
            <FieldGroup className="gap-2">
              <Field>
                <FieldLabel htmlFor="preset-name">Aktuell speichern</FieldLabel>
                <Input
                  id="preset-name"
                  value={presetName}
                  placeholder="CELL-1 Nacht"
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </Field>
              <Button
                size="sm"
                variant="outline"
                disabled={presetName.trim() === ""}
                onClick={() => {
                  saveCurrentPreset(presetName)
                  setPresetName("")
                }}
              >
                Vorlage speichern
              </Button>
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-0 flex-1 justify-start"
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.name}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deletePreset(preset.id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </FieldGroup>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="search">Suche</FieldLabel>
            <Input
              id="search"
              value={filters.search}
              placeholder="AO, Serie, Fehler, IP…"
              onChange={(event) => patchFilters({ search: event.target.value })}
            />
          </Field>
          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel htmlFor="anomalies">Nur Anomalien</FieldLabel>
            <Switch
              id="anomalies"
              checked={filters.onlyAnomalies}
              onCheckedChange={(checked) =>
                patchFilters({ onlyAnomalies: Boolean(checked) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="from">Von</FieldLabel>
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
            <FieldLabel htmlFor="to">Bis</FieldLabel>
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
            <FieldLabel htmlFor="min-cycle">Min. Takt ms</FieldLabel>
            <Input
              id="min-cycle"
              type="number"
              value={filters.minCycleMs ?? ""}
              onChange={(event) =>
                patchFilters({
                  minCycleMs:
                    event.target.value === ""
                      ? null
                      : finiteOrNull(Number(event.target.value)),
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="max-cycle">Max. Takt ms</FieldLabel>
            <Input
              id="max-cycle"
              type="number"
              value={filters.maxCycleMs ?? ""}
              onChange={(event) =>
                patchFilters({
                  maxCycleMs:
                    event.target.value === ""
                      ? null
                      : finiteOrNull(Number(event.target.value)),
                })
              }
            />
          </Field>
          <OptionList
            legend="Werk"
            options={facets.plants}
            selected={filters.plants}
            onToggle={(value) =>
              patchFilters({ plants: toggleValue(filters.plants, value) })
            }
          />
          <OptionList
            legend="Linie"
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
            legend="Maschine"
            options={facets.machines}
            selected={filters.machines}
            onToggle={(value) =>
              patchFilters({ machines: toggleValue(filters.machines, value) })
            }
          />
          <OptionList
            legend="Steuerung"
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
            legend="Schicht"
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
            legend="Auftrag"
            options={facets.workOrders}
            selected={filters.workOrders}
            limit={8}
            onToggle={(value) =>
              patchFilters({
                workOrders: toggleValue(filters.workOrders, value),
              })
            }
          />
          <OptionList
            legend="Ergebnis"
            options={[...CYCLE_RESULTS]}
            selected={filters.results}
            onToggle={(value) => {
              if (value === "PASS" || value === "FAIL" || value === "REWORK") {
                patchFilters({ results: toggleValue(filters.results, value) })
              }
            }}
          />
          <OptionList
            legend="Alarmstufe"
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
            legend="Stillstand"
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
