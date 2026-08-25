import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"
import { PrinterForm } from "@/components/forms/printer-form"
import { blankPrinter } from "@/domain/blanks"
import { PageHeader } from "@/components/page-header"
import { RecordSheet } from "@/components/record-sheet"
import { StatusBadge } from "@/components/status-badge"
import { newId } from "@/domain/catalog"
import { DEPARTMENT_LABELS, PRINTER_TYPE_LABELS } from "@/domain/labels"
import type { Printer } from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

export function PrintersPage() {
  const { state, savePrinter, deletePrinter } = useInventory()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<Printer | null>(null)

  const rows = useMemo(
    () =>
      state.printers.filter((item) =>
        matchesQuery(
          [
            item.assetTag,
            item.serialNumber,
            item.make,
            item.model,
            item.location,
            item.ipAddress,
            DEPARTMENT_LABELS[item.department],
            PRINTER_TYPE_LABELS[item.printerType],
          ],
          query,
        ),
      ),
    [query, state.printers],
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Printers"
        description="Shop floor labelers, plotters, and office MFPs. IP and location stay on the consulting printer tab."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Printers")
                } catch {
                  toast.error("Export failed")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankPrinter(newId()))}>Add printer</Button>
          </>
        }
      />
      <div className="border bg-muted/30 px-2 py-2">
        <Input
          className="w-72"
          placeholder="Search tag, IP, location, type..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="No printers match"
        emptyDescription="Add a printer or clear the search."
        columns={[
          { header: "Tag", cell: (row) => row.assetTag },
          { header: "Device", cell: (row) => `${row.make} ${row.model}` },
          { header: "Type", cell: (row) => PRINTER_TYPE_LABELS[row.printerType] },
          { header: "Department", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Location", cell: (row) => row.location },
          { header: "IP", cell: (row) => row.ipAddress || "—" },
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
                    const error = deletePrinter(row.id)
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
        title={draft && state.printers.some((item) => item.id === draft.id) ? "Edit printer" : "Add printer"}
        description="Keep serial and IP filled so floor walks match the register."
        submitLabel="Save printer"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = savePrinter(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Printer saved")
          setDraft(null)
        }}
      >
        {draft ? <PrinterForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}
