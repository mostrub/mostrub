import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
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
            item.inventoryNumber,
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
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Software"
        description="Plätze, Verlängerungen und Lizenzschlüssel. Überbelegte Titel werden gespeichert und stehen unter Prüfung."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Software licenses")
                } catch {
                  toast.error("Export fehlgeschlagen")
                }
              }}
            >
              CSV
            </Button>
            <Button onClick={() => setDraft(blankSoftware(newId()))}>Titel anlegen</Button>
          </>
        }
      />
      <div className="border bg-muted/30 px-2 py-2">
        <Input
          className="w-72"
          placeholder="Name, Hersteller, Lizenzschlüssel..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="Keine Software gefunden"
        emptyDescription="Titel anlegen oder Suche leeren."
        columns={[
          { header: "Inv.-Nr.", cell: (row) => row.inventoryNumber },
          { header: "Name", cell: (row) => row.name },
          { header: "Hersteller", cell: (row) => row.vendor },
          { header: "Typ", cell: (row) => LICENSE_TYPE_LABELS[row.licenseType] },
          {
            header: "Plätze",
            cell: (row) => `${row.seatsAssigned} / ${row.seatsPurchased}`,
          },
          { header: "Abteilung", cell: (row) => DEPARTMENT_LABELS[row.department] },
          { header: "Verlängerung", cell: (row) => row.renewalDate || "—" },
          {
            header: "Jahreskosten",
            cell: (row) =>
              row.annualCost.toLocaleString("de-DE", {
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
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link to={`/history?q=${encodeURIComponent(row.inventoryNumber)}`} />}
                  nativeButton={false}
                >
                  Historie
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft(row)}>
                  Bearbeiten
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
        title={draft && state.software.some((item) => item.id === draft.id) ? "Software bearbeiten" : "Software anlegen"}
        description="Mehr zugewiesene als gekaufte Plätze werden gespeichert und als Befund geführt."
        submitLabel="Software speichern"
        onSubmit={() => {
          if (!draft) {
            return
          }
          const error = saveSoftware(draft)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Software gespeichert")
          setDraft(null)
        }}
      >
        {draft ? <SoftwareForm value={draft} onChange={setDraft} /> : null}
      </RecordSheet>
    </div>
  )
}
