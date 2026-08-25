import { useMemo, useState } from "react"
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
        description="Tracked by department, hardware type, and operating system. Use Destroy on the destruction register when a unit is wiped or shredded."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Laptops")
                } catch {
                  toast.error("Export failed")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankLaptop(newId()))}>Add laptop</Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border bg-muted/30 px-2 py-2">
        <Input
          className="w-72"
          placeholder="Search tag, serial, user, department, OS..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <FilterSelect
          label="Department"
          value={department}
          onChange={setDepartment}
          items={[
            { value: "all", label: "All departments" },
            ...DEPARTMENTS.map((value) => ({
              value,
              label: DEPARTMENT_LABELS[value],
            })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={laptopType}
          onChange={setLaptopType}
          items={[
            { value: "all", label: "All types" },
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
            { value: "all", label: "All OS" },
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
            { value: "active", label: "Hide destroyed" },
            { value: "all", label: "All statuses" },
            ...ASSET_STATUSES.map((value) => ({
              value,
              label: STATUS_LABELS[value],
            })),
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="No laptops match"
        emptyDescription="Add a laptop or clear the search."
        columns={[
          { header: "Tag", cell: (row) => row.assetTag },
          { header: "Hostname", cell: (row) => row.hostname },
          { header: "Type", cell: (row) => LAPTOP_TYPE_LABELS[row.laptopType] },
          { header: "OS", cell: (row) => OS_LABELS[row.operatingSystem] },
          { header: "Department", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Assigned", cell: (row) => row.assignedTo || "—" },
          { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
          {
            header: "",
            className: "text-right",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Edit
                </Button>
                <ConfirmDelete
                  label={row.assetTag}
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
        title={draft && state.laptops.some((item) => item.id === draft.id) ? "Edit laptop" : "Add laptop"}
        description="Department, type, and OS are required for audit grouping."
        submitLabel="Save laptop"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveLaptop(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Laptop saved")
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
