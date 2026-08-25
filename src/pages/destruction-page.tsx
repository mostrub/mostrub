import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"
import { DataTable } from "@/components/data-table"
import { DestructionForm } from "@/components/forms/destruction-form"
import { blankDestruction } from "@/domain/blanks"
import { PageHeader } from "@/components/page-header"
import { RecordSheet } from "@/components/record-sheet"
import { newId } from "@/domain/catalog"
import {
  ASSET_KIND_LABELS,
  DEPARTMENT_LABELS,
  DESTRUCTION_METHOD_LABELS,
} from "@/domain/labels"
import type { DestructionRecord } from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

export function DestructionPage() {
  const { state, saveDestruction, deleteDestruction } = useInventory()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<DestructionRecord | null>(null)

  const rows = useMemo(
    () =>
      state.destructions.filter((item) =>
        matchesQuery(
          [
            item.assetTag,
            item.serialNumber,
            item.witnessedBy,
            item.certificateId,
            item.reason,
            DEPARTMENT_LABELS[item.department],
            DESTRUCTION_METHOD_LABELS[item.method],
          ],
          query,
        ),
      ),
    [query, state.destructions],
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Destruction"
        description="Chain of custody for wiped, shredded, degaussed, or vendor-returned assets. If the tag still exists on a laptop or printer, that record is marked destroyed."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Destruction log")
                } catch {
                  toast.error("Export failed")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankDestruction(newId()))}>
              Log destruction
            </Button>
          </>
        }
      />
      <Input
        placeholder="Search tag, witness, certificate, method..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <DataTable
        rows={rows}
        emptyTitle="No destruction records"
        emptyDescription="Log a wipe or shred when hardware leaves the plant."
        columns={[
          { header: "Tag", cell: (row) => row.assetTag },
          { header: "Kind", cell: (row) => ASSET_KIND_LABELS[row.assetKind] },
          { header: "Method", cell: (row) => DESTRUCTION_METHOD_LABELS[row.method] },
          { header: "Department", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Date", cell: (row) => row.destroyedOn },
          { header: "Witness", cell: (row) => row.witnessedBy || "—" },
          { header: "Certificate", cell: (row) => row.certificateId || "—" },
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
                  description="This removes the destruction log. If this was the last log for the asset, its status returns to in service."
                  onConfirm={() => deleteDestruction(row.id)}
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
        title={
          draft && state.destructions.some((item) => item.id === draft.id)
            ? "Edit destruction"
            : "Log destruction"
        }
        description="Witness and certificate ID are what consulting teams look for first."
        submitLabel="Save record"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveDestruction(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Destruction recorded")
          setDraft(null)
        }}
      >
        {draft ? <DestructionForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}
