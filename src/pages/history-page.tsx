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
        title="Device history"
        description="Search by inventory number, asset tag, or serial to see create, assignment, status, and destruction events for a device."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              try {
                downloadRegisterCsv(state, "Device history")
              } catch {
                toast.error("Export failed")
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
          placeholder="Inventory #, tag, or serial..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit">Search history</Button>
      </form>
      <DataTable
        rows={rows}
        emptyTitle={query ? "No history matches that search" : "No history yet"}
        emptyDescription={
          query
            ? "Try the inventory number, asset tag, or serial printed on the device."
            : "Saves, assignment changes, and destruction logs show up here."
        }
        columns={[
          {
            header: "When",
            cell: (row) => row.at.replace("T", " ").replace(/\.\d+Z$/, " UTC"),
          },
          { header: "Action", cell: (row) => historyActionLabel(row.action) },
          { header: "Inventory #", cell: (row) => row.inventoryNumber || "—" },
          { header: "Tag", cell: (row) => row.assetTag || "—" },
          { header: "Serial", cell: (row) => row.serialNumber || "—" },
          { header: "Summary", cell: (row) => row.summary },
          { header: "Changes", cell: (row) => row.changeText },
        ]}
      />
    </div>
  )
}
