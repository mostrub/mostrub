import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { formatHistoryChanges, historyActionLabel, queryDeviceHistory } from "@/domain/history"
import { downloadRegisterCsv } from "@/export/download"
import { useInventory } from "@/store/inventory-context"

export function HistoryPage() {
  const { state } = useInventory()
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const [draft, setDraft] = useState(query)

  useEffect(() => {
    setDraft(query)
  }, [query])

  const rows = useMemo(() => {
    if (!query.trim()) {
      return []
    }
    return queryDeviceHistory(state, query).map((event) => ({
      ...event,
      changeText: formatHistoryChanges(event.changes),
    }))
  }, [query, state])

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Gerätehistorie"
        description="Genau nach Inventarnummer, Anlagenkennzeichen oder Serie suchen. Teiltreffer wie INV-0001 in INV-00010 zählen nicht."
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
        {query ? (
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "Eintrag" : "Einträge"}
          </p>
        ) : null}
      </form>
      <DataTable
        rows={rows}
        emptyTitle={query ? "Keine Historie zu dieser Suche" : "Gerät suchen"}
        emptyDescription={
          query
            ? "Inventarnummer, Anlagenkennzeichen oder Serie vom Gerät versuchen."
            : "Eine Inventarnummer, ein Kennzeichen oder eine Serie eingeben. Die ganze Werkhistorie wird nicht auf einmal gezeigt."
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
          {
            header: "Kurztext",
            className: "max-w-xs whitespace-normal break-words",
            cell: (row) => row.summary,
          },
          {
            header: "Änderungen",
            className: "max-w-sm whitespace-normal break-words",
            cell: (row) => row.changeText,
          },
        ]}
      />
    </div>
  )
}
