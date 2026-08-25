import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { collectAuditFindings } from "@/domain/findings"
import { DEPARTMENT_LABELS, FINDING_LABELS } from "@/domain/labels"
import { downloadAuditWorkbook, downloadRegisterCsv } from "@/export/download"
import { localDateStamp } from "@/lib/dates"
import { useInventory } from "@/store/inventory-context"
import { toast } from "sonner"

export function AuditPage() {
  const { state } = useInventory()
  const findings = collectAuditFindings(state, {
    today: localDateStamp(),
  }).map((finding) => ({ ...finding, id: `${finding.code}-${finding.recordId}` }))

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Prüfung"
        description="Was die Prüfung zuerst fragt: fehlende Seriennummern, abgelaufene Garantien, nicht zugewiesene Laptops im Einsatz, abgelaufene oder bald fällige Lizenzen, Vernichtung ohne Zeugen."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Audit findings")
                } catch {
                  toast.error("Export fehlgeschlagen")
                }
              }}
            >
              Befunde CSV
            </Button>
            <Button
              onClick={() => {
                void downloadAuditWorkbook(state)
                  .then(() => {
                    toast.success("Excel-Mappe heruntergeladen")
                  })
                  .catch(() => {
                    toast.error("Export fehlgeschlagen")
                  })
              }}
            >
              Excel-Mappe
            </Button>
          </>
        }
      />
      <DataTable
        rows={findings}
        emptyTitle="Register ist sauber"
        emptyDescription="Keine aktuellen Abweichungen. Die Mappe trotzdem als Stichtagsstand exportieren."
        columns={[
          {
            header: "Schwere",
            cell: (row) => (
              <Badge variant={row.severity === "high" ? "destructive" : "outline"}>
                {row.severity}
              </Badge>
            ),
          },
          { header: "Befund", cell: (row) => FINDING_LABELS[row.code] },
          { header: "Register", cell: (row) => row.register },
          { header: "Inv.-Nr.", cell: (row) => row.inventoryNumber || "—" },
          { header: "Gerät", cell: (row) => row.assetTag },
          {
            header: "Abteilung",
            cell: (row) => (row.department ? DEPARTMENT_LABELS[row.department] : "—"),
          },
          { header: "Kurztext", cell: (row) => row.summary },
        ]}
      />
    </div>
  )
}
