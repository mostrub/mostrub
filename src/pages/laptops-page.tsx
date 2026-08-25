import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"
import { LaptopForm } from "@/components/forms/laptop-form"
import { PageHeader } from "@/components/page-header"
import { RecordSheet } from "@/components/record-sheet"
import { StatusBadge } from "@/components/status-badge"
import { blankLaptop } from "@/domain/blanks"
import { newId } from "@/domain/catalog"
import {
  DEPARTMENT_LABELS,
  LAPTOP_TYPE_LABELS,
  OS_LABELS,
  STATUS_LABELS,
} from "@/domain/labels"
import {
  DEPARTMENTS,
  LAPTOP_TYPES,
  OPERATING_SYSTEMS,
  ASSET_STATUSES,
  type AssetStatus,
  type Department,
  type Laptop,
  type LaptopType,
  type OperatingSystem,
} from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { destructionHref, historyHref, recordLabel } from "@/lib/hardware-links"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

type DepartmentFilter = Department | "all"
type TypeFilter = LaptopType | "all"
type OsFilter = OperatingSystem | "all"
type StatusFilter = AssetStatus | "all" | "active"

export function LaptopsPage() {
  const { state, saveLaptop, deleteLaptop } = useInventory()
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState<DepartmentFilter>("all")
  const [laptopType, setLaptopType] = useState<TypeFilter>("all")
  const [operatingSystem, setOperatingSystem] = useState<OsFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("active")
  const [draft, setDraft] = useState<Laptop | null>(null)

  const rows = useMemo(
    () =>
      state.laptops.filter((item) => {
        if (department !== "all" && item.department !== department) {
          return false
        }
        if (laptopType !== "all" && item.laptopType !== laptopType) {
          return false
        }
        if (operatingSystem !== "all" && item.operatingSystem !== operatingSystem) {
          return false
        }
        if (status === "active" && item.status === "destroyed") {
          return false
        }
        if (status !== "all" && status !== "active" && item.status !== status) {
          return false
        }
        return matchesQuery(
          [
            item.inventoryNumber,
            item.assetTag,
            item.serialNumber,
            item.hostname,
            item.make,
            item.model,
            item.assignedTo,
            item.location,
            DEPARTMENT_LABELS[item.department],
            LAPTOP_TYPE_LABELS[item.laptopType],
            OS_LABELS[item.operatingSystem],
          ],
          query,
        )
      }),
    [department, laptopType, operatingSystem, query, state.laptops, status],
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Laptops"
        description="Nach Abteilung, Gerätetyp und Betriebssystem. Vernichtung über das Vernichtungsregister, wenn ein Gerät gelöscht oder geschreddert wird."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Laptops")
                } catch {
                  toast.error("Export fehlgeschlagen")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankLaptop(newId()))}>Laptop anlegen</Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border bg-muted/30 px-2 py-2">
        <Input
          className="w-72"
          placeholder="Inventarnummer, Kennzeichen, Serie, Nutzer, Abteilung, OS..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <FilterSelect
          label="Abteilung"
          value={department}
          onChange={setDepartment}
          items={[
            { value: "all", label: "Alle Abteilungen" },
            ...DEPARTMENTS.map((value) => ({
              value,
              label: DEPARTMENT_LABELS[value],
            })),
          ]}
        />
        <FilterSelect
          label="Typ"
          value={laptopType}
          onChange={setLaptopType}
          items={[
            { value: "all", label: "Alle Typen" },
            ...LAPTOP_TYPES.map((value) => ({
              value,
              label: LAPTOP_TYPE_LABELS[value],
            })),
          ]}
        />
        <FilterSelect
          label="OS"
          value={operatingSystem}
          onChange={setOperatingSystem}
          items={[
            { value: "all", label: "Alle OS" },
            ...OPERATING_SYSTEMS.map((value) => ({
              value,
              label: OS_LABELS[value],
            })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          items={[
            { value: "active", label: "Vernichtete ausblenden" },
            { value: "all", label: "Alle Status" },
            ...ASSET_STATUSES.map((value) => ({
              value,
              label: STATUS_LABELS[value],
            })),
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="Keine Laptops gefunden"
        emptyDescription="Laptop anlegen oder Suche leeren."
        columns={[
          { header: "Inv.-Nr.", cell: (row) => row.inventoryNumber },
          { header: "Kennzeichen", cell: (row) => row.assetTag },
          { header: "Serie", cell: (row) => row.serialNumber || "—" },
          { header: "Hostname", cell: (row) => row.hostname },
          { header: "Typ", cell: (row) => LAPTOP_TYPE_LABELS[row.laptopType] },
          { header: "OS", cell: (row) => OS_LABELS[row.operatingSystem] },
          { header: "Abteilung", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Zugewiesen", cell: (row) => row.assignedTo || "—" },
          { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
          {
            header: "",
            className: "text-right",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link to={historyHref(row.inventoryNumber)} />}
                  nativeButton={false}
                >
                  Historie
                </Button>
                {row.status === "destroyed" ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link
                        to={destructionHref({
                          kind: "laptop",
                          inventoryNumber: row.inventoryNumber,
                          assetTag: row.assetTag,
                          serialNumber: row.serialNumber,
                          department: row.department,
                        })}
                      />
                    }
                    nativeButton={false}
                  >
                    Vernichten
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Bearbeiten
                </Button>
                <ConfirmDelete
                  label={recordLabel(row.inventoryNumber, row.assetTag)}
                  onConfirm={() => {
                    const error = deleteLaptop(row.id)
                    if (error) {
                      toast.error(error)
                    }
                  }}
                />
              </div>
            ),
          },
        ]}
      />
      <RecordSheet
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null)
          }
        }}
        title={draft && state.laptops.some((item) => item.id === draft.id) ? "Laptop bearbeiten" : "Laptop anlegen"}
        description="Abteilung, Typ und Betriebssystem sind für die Prüfung Pflicht."
        submitLabel="Laptop speichern"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveLaptop(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Laptop gespeichert")
          setDraft(null)
        }}
      >
        {draft ? <LaptopForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string }[]
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        className="h-8 rounded-sm border border-input bg-background px-2 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
