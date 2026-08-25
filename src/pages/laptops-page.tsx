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
} from "@/domain/labels"
import type { Laptop } from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

export function LaptopsPage() {
  const { state, saveLaptop, deleteLaptop } = useInventory()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<Laptop | null>(null)

  const rows = useMemo(
    () =>
      state.laptops.filter((item) =>
        matchesQuery(
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
        ),
      ),
    [query, state.laptops],
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Laptops"
        description="Tracked by department, hardware type, and operating system. Use Destroy on the destruction register when a unit is wiped or shredded."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadRegisterCsv(state, "Laptops")}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankLaptop(newId()))}>Add laptop</Button>
          </>
        }
      />
      <Input
        placeholder="Search tag, serial, user, department, OS..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
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
                  onConfirm={() => deleteLaptop(row.id)}
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
