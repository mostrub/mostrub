import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { collectAuditFindings } from "@/domain/findings"
import { DEPARTMENT_LABELS, FINDING_LABELS } from "@/domain/labels"
import { DEPARTMENTS } from "@/domain/types"
import { useInventory } from "@/store/inventory-context"

export function DashboardPage() {
  const { state } = useInventory()
  const findings = collectAuditFindings(state, {
    today: new Date().toISOString().slice(0, 10),
  })
  const inService = state.laptops.filter((item) => item.status === "in-service").length

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Plant inventory"
        description="Laptops by department and type, printers, software seats, and destruction records. Consulting teams can pull a tabbed Excel workbook from Export."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Laptops" value={state.laptops.length} detail={`${inService} in service`} />
        <Stat title="Printers" value={state.printers.length} detail="All locations" />
        <Stat
          title="Software titles"
          value={state.software.length}
          detail={`${state.software.reduce((sum, item) => sum + item.seatsAssigned, 0)} seats assigned`}
        />
        <Stat
          title="Audit findings"
          value={findings.length}
          detail={`${state.destructions.length} destruction records`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Laptops by department</CardTitle>
            <CardDescription>Active counts include every status except destroyed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {DEPARTMENTS.map((department) => {
                const count = state.laptops.filter(
                  (item) => item.department === department,
                ).length
                if (count === 0) {
                  return null
                }
                return (
                  <li
                    key={department}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{DEPARTMENT_LABELS[department]}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open findings</CardTitle>
            <CardDescription>
              Missing serials, expired warranties, unassigned gear, and chain-of-custody gaps.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {findings.slice(0, 6).map((finding) => (
              <div key={`${finding.code}-${finding.recordId}`} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant={finding.severity === "high" ? "destructive" : "outline"}>
                    {FINDING_LABELS[finding.code]}
                  </Badge>
                  <span className="text-sm">{finding.assetTag}</span>
                </div>
                <p className="text-sm text-muted-foreground">{finding.summary}</p>
              </div>
            ))}
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings on the current register.</p>
            ) : (
              <Button render={<Link to="/audit" />} variant="outline" nativeButton={false}>
                Review all findings
              </Button>
            )}
          </CardContent>
        </Card>
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
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
