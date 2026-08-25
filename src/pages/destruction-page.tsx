import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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
import { DEPARTMENTS, type DestructionRecord } from "@/domain/types"
import { downloadRegisterCsv } from "@/export/download"
import { historyHref, recordLabel } from "@/lib/hardware-links"
import { matchesQuery } from "@/lib/search"
import { useInventory } from "@/store/inventory-context"

export function DestructionPage() {
  const { state, saveDestruction, deleteDestruction } = useInventory()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<DestructionRecord | null>(null)

  useEffect(() => {
    const tag = params.get("tag")
    const inv = params.get("inv")
    if (!tag && !inv) {
      return
    }
    const kind = params.get("kind") === "printer" ? "printer" : "laptop"
    const department = DEPARTMENTS.find((item) => item === params.get("dept")) ?? "it"
    setDraft({
      ...blankDestruction(newId()),
      assetKind: kind,
      inventoryNumber: inv ?? "",
      assetTag: tag ?? "",
      serialNumber: params.get("serial") ?? "",
      department,
    })
    const next = new URLSearchParams(params)
    next.delete("tag")
    next.delete("inv")
    next.delete("kind")
    next.delete("serial")
    next.delete("dept")
    setParams(next, { replace: true })
  }, [params, setParams])

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
        description="Vernichten heißt: das Gerät verlässt das Werk. Sicheres Löschen, Schreddern, Entmagnetisieren oder Rückgabe — mit Zeuge. Das ist nicht Löschen aus dem Register."
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
                    <Link to={historyHref(row.inventoryNumber || row.assetTag)} />
                  }
                  nativeButton={false}
                >
                  Historie
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Bearbeiten
                </Button>
                <ConfirmDelete
                  label={recordLabel(row.inventoryNumber, row.assetTag)}
                  confirmText={row.inventoryNumber || row.assetTag}
                  description="Der Vernichtungseintrag wird entfernt. War es der letzte Eintrag zum Gerät, geht der Status zurück auf Im Einsatz."
                  onConfirm={() => {
                    const error = deleteDestruction(row.id)
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
