import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadText } from "@/lib/download"
import { reportToText } from "@/lib/reports"
import { useFloorline } from "@/state/floorline-store"

export function ReportsPage() {
  const { reports, files } = useFloorline()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Auto reporting</h2>
          <p className="text-sm text-muted-foreground">
            Rebuilds from DuckDB whenever data or filters change. Print this
            page or export a text pack.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={reports.length === 0}
          onClick={() => {
            const text = reports.map(reportToText).join("\n\n---\n\n")
            downloadText({
              text,
              fileName: "floorline-reports.txt",
              mime: "text/plain",
            })
          }}
        >
          Export report pack
        </Button>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ingest production XML to generate shift, triage, and server reports.
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-3 print:grid-cols-1">
        {reports.map((report) => (
          <Card key={report.id} className="break-inside-avoid">
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {report.kpis.map((kpi) => (
                  <Badge
                    key={kpi.label}
                    variant={kpi.tone === "bad" ? "destructive" : "secondary"}
                  >
                    {kpi.label}: {kpi.value}
                  </Badge>
                ))}
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
                {report.findings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
              {report.tables.map((table) => (
                <div key={table.title} className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {table.title}
                  </p>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          {table.columns.map((column) => (
                            <th key={column} className="px-1 py-1 font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, index) => (
                          <tr key={index} className="border-b">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-1 py-1 font-mono">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Generated {report.generatedAt}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
