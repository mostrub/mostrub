import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
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
            item.inventoryNumber,
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
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Vernichtung"
        description="Nachweis für gelöschte, geschredderte, entmagnetisierte oder zurückgegebene Geräte. Existiert das Kennzeichen noch am Laptop oder Drucker, wird der Datensatz als vernichtet markiert."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Destruction log")
                } catch {
                  toast.error("Export fehlgeschlagen")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankDestruction(newId()))}>
              Vernichtung erfassen
            </Button>
          </>
        }
      />
      <div className="border bg-muted/30 px-2 py-2">
        <Input
          className="w-72"
          placeholder="Kennzeichen, Zeuge, Zertifikat, Verfahren..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="Keine Vernichtungseinträge"
        emptyDescription="Löschen oder Schreddern erfassen, wenn Hardware das Werk verlässt."
        columns={[
          { header: "Inv.-Nr.", cell: (row) => row.inventoryNumber || "—" },
          { header: "Kennzeichen", cell: (row) => row.assetTag },
          { header: "Art", cell: (row) => ASSET_KIND_LABELS[row.assetKind] },
          { header: "Verfahren", cell: (row) => DESTRUCTION_METHOD_LABELS[row.method] },
          { header: "Abteilung", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Datum", cell: (row) => row.destroyedOn },
          { header: "Zeuge", cell: (row) => row.witnessedBy || "—" },
          { header: "Zertifikat", cell: (row) => row.certificateId || "—" },
          {
            header: "",
            className: "text-right",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  render={
                    <Link
                      to={`/history?q=${encodeURIComponent(row.inventoryNumber || row.assetTag)}`}
                    />
                  }
                  nativeButton={false}
                >
                  Historie
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Bearbeiten
                </Button>
                <ConfirmDelete
                  label={row.assetTag}
                  description="Der Vernichtungseintrag wird entfernt. War es der letzte Eintrag zum Gerät, geht der Status zurück auf Im Einsatz."
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
            ? "Vernichtung bearbeiten"
            : "Vernichtung erfassen"
        }
        description="Zeuge und Zertifikat sind das Erste, wonach die Prüfung sucht."
        submitLabel="Eintrag speichern"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveDestruction(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Vernichtung erfasst")
          setDraft(null)
        }}
      >
        {draft ? <DestructionForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}
