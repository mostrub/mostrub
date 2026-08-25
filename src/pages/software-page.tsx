import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"
import { SoftwareForm } from "@/components/forms/software-form"
import { blankSoftware } from "@/domain/blanks"
import { PageHeader } from "@/components/page-header"
import { RecordSheet } from "@/components/record-sheet"
import { newId } from "@/domain/catalog"
import { DEPARTMENT_LABELS, LICENSE_TYPE_LABELS } from "@/domain/labels"
import type { SoftwareLicense } from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

export function SoftwarePage() {
  const { state, saveSoftware, deleteSoftware } = useInventory()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<SoftwareLicense | null>(null)

  const rows = useMemo(
    () =>
      state.software.filter((item) =>
        matchesQuery(
          [
            item.name,
            item.vendor,
            item.entitlementId,
            DEPARTMENT_LABELS[item.department],
            LICENSE_TYPE_LABELS[item.licenseType],
          ],
          query,
        ),
      ),
    [query, state.software],
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Software"
        description="Seat counts, renewals, and entitlement IDs. Over-assigned titles are blocked on save and listed on the audit tab."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadRegisterCsv(state, "Software licenses")}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankSoftware(newId()))}>Add title</Button>
          </>
        }
      />
      <Input
        placeholder="Search name, vendor, entitlement..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <DataTable
        rows={rows}
        emptyTitle="No software matches"
        emptyDescription="Add a title or clear the search."
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Vendor", cell: (row) => row.vendor },
          { header: "Type", cell: (row) => LICENSE_TYPE_LABELS[row.licenseType] },
          {
            header: "Seats",
            cell: (row) => `${row.seatsAssigned} / ${row.seatsPurchased}`,
          },
          { header: "Department", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Renewal", cell: (row) => row.renewalDate || "—" },
          {
            header: "Annual",
            cell: (row) =>
              row.annualCost.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }),
          },
          {
            header: "",
            className: "text-right",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Edit
                </Button>
                <ConfirmDelete
                  label={row.name}
                  onConfirm={() => deleteSoftware(row.id)}
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
        title={draft && state.software.some((item) => item.id === draft.id) ? "Edit software" : "Add software"}
        description="Assigned seats cannot exceed purchased seats."
        submitLabel="Save software"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveSoftware(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Software saved")
          setDraft(null)
        }}
      >
        {draft ? <SoftwareForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}
