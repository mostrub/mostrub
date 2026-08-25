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
        title="Audit"
        description="Exceptions consulting teams usually ask for: missing serials, expired warranties, unassigned in-service laptops, expired or soon-to-renew licenses, and destruction without a witness."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  downloadRegisterCsv(state, "Audit findings")
                } catch {
                  toast.error("Export failed")
                }
              }}
            >
              Findings CSV
            </Button>
            <Button
              onClick={() => {
                void downloadAuditWorkbook(state)
                  .then(() => {
                    toast.success("Excel workbook downloaded")
                  })
                  .catch(() => {
                    toast.error("Export failed")
                  })
              }}
            >
              Excel workbook
            </Button>
          </>
        }
      />
      <DataTable
        rows={findings}
        emptyTitle="Register is clean"
        emptyDescription="No current exceptions. Export the workbook anyway for a dated snapshot."
        columns={[
          {
            header: "Severity",
            cell: (row) => (
              <Badge variant={row.severity === "high" ? "destructive" : "outline"}>
                {row.severity}
              </Badge>
            ),
          },
          { header: "Finding", cell: (row) => FINDING_LABELS[row.code] },
          { header: "Register", cell: (row) => row.register },
          { header: "Asset", cell: (row) => row.assetTag },
          {
            header: "Department",
            cell: (row) => (row.department ? DEPARTMENT_LABELS[row.department] : "—"),
          },
          { header: "Summary", cell: (row) => row.summary },
        ]}
      />
    </div>
  )
}
