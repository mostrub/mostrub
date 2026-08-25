import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { collectAuditFindings } from "@/domain/findings"
import { DEPARTMENT_LABELS, FINDING_LABELS } from "@/domain/labels"
import { countLaptopsByDepartment, summarizeInventory } from "@/domain/summary"
import { localDateStamp } from "@/lib/dates"
import { useInventory } from "@/store/inventory-context"

export function DashboardPage() {
  const { state } = useInventory()
  const findings = collectAuditFindings(state, {
    today: localDateStamp(),
  })
  const summary = summarizeInventory(state)
  const departmentCounts = countLaptopsByDepartment(state)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <PageHeader
        title="Plant inventory"
        description="Laptops by department and type, printers, software seats, and destruction records. Consulting teams can pull a tabbed Excel workbook from Export."
      />
      <div className="grid grid-cols-4 divide-x border bg-card">
        <Stat title="Laptops" value={summary.laptops} detail={`${summary.laptopsInService} in service`} />
        <Stat title="Printers" value={summary.printers} detail="All locations" />
        <Stat
          title="Software titles"
          value={summary.software}
          detail={`${summary.seatsAssigned} seats assigned`}
        />
        <Stat
          title="Audit findings"
          value={findings.length}
          detail={`${summary.destructions} destruction records`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <section className="border bg-card">
          <header className="border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Laptops by department</h2>
            <p className="text-xs text-muted-foreground">
              Active counts include every status except destroyed.
            </p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-left">
              <tr className="border-b">
                <th className="px-3 py-1.5 font-medium">Department</th>
                <th className="px-3 py-1.5 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {departmentCounts.map((row) => (
                <tr key={row.department} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{DEPARTMENT_LABELS[row.department]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="border bg-card">
          <header className="border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Open findings</h2>
            <p className="text-xs text-muted-foreground">
              Missing serials, expired warranties, unassigned gear, and chain-of-custody gaps.
            </p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-left">
              <tr className="border-b">
                <th className="px-3 py-1.5 font-medium">Finding</th>
                <th className="px-3 py-1.5 font-medium">Asset</th>
                <th className="px-3 py-1.5 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {findings.slice(0, 8).map((finding) => (
                <tr key={`${finding.code}-${finding.recordId}`} className="border-b last:border-0">
                  <td className="px-3 py-1.5">
                    <Badge variant={finding.severity === "high" ? "destructive" : "outline"}>
                      {FINDING_LABELS[finding.code]}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{finding.assetTag}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{finding.summary}</td>
                </tr>
              ))}
              {findings.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                    No findings on the current register.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {findings.length > 0 ? (
            <div className="border-t px-3 py-2">
              <Button render={<Link to="/audit" />} variant="outline" size="sm" nativeButton={false}>
                Open audit register
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function Stat({
  title,
  value,
  detail,
}: {
  title: string
  value: number
  detail: string
}) {
  return (
    <div className="flex items-baseline gap-3 px-3 py-2">
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
