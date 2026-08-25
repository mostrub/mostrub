import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { historyActionLabel, queryDeviceHistory } from "@/domain/history"
import { downloadRegisterCsv } from "@/export/download"
import { useInventory } from "@/store/inventory-context"

export function HistoryPage() {
  const { state } = useInventory()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(params.get("q") ?? "")
  const query = params.get("q") ?? ""

  const rows = useMemo(
    () =>
      queryDeviceHistory(state, query).map((event) => ({
        ...event,
        changeText:
          event.changes.length === 0
            ? "—"
            : event.changes
                .map((change) => `${change.field}: ${change.from || "—"} → ${change.to || "—"}`)
                .join("; "),
      })),
    [query, state],
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Gerätehistorie"
        description="Nach Inventarnummer, Anlagenkennzeichen oder Serie suchen, um Anlage, Zuweisung, Status und Vernichtung eines Geräts zu sehen."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              try {
                downloadRegisterCsv(state, "Device history")
              } catch {
                toast.error("Export fehlgeschlagen")
              }
            }}
          >
            CSV
          </Button>
        }
      />
      <form
        className="flex items-center gap-2 border bg-muted/30 px-2 py-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = new URLSearchParams(params)
          if (draft.trim()) {
            next.set("q", draft.trim())
          } else {
            next.delete("q")
          }
          setParams(next, { replace: true })
        }}
      >
        <Input
          className="w-96"
          placeholder="Inventarnummer, Kennzeichen oder Serie..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit">Historie suchen</Button>
      </form>
      <DataTable
        rows={rows}
        emptyTitle={query ? "Keine Historie zu dieser Suche" : "Noch keine Historie"}
        emptyDescription={
          query
            ? "Inventarnummer, Anlagenkennzeichen oder Serie vom Gerät versuchen."
            : "Speichern, Zuweisungen und Vernichtung erscheinen hier."
        }
        columns={[
          {
            header: "Wann",
            cell: (row) => row.at.replace("T", " ").replace(/\.\d+Z$/, " UTC"),
          },
          { header: "Aktion", cell: (row) => historyActionLabel(row.action) },
          { header: "Inv.-Nr.", cell: (row) => row.inventoryNumber || "—" },
          { header: "Kennzeichen", cell: (row) => row.assetTag || "—" },
          { header: "Serie", cell: (row) => row.serialNumber || "—" },
          { header: "Kurztext", cell: (row) => row.summary },
          { header: "Änderungen", cell: (row) => row.changeText },
        ]}
      />
    </div>
  )
}
