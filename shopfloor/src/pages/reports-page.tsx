import { EmptyProduction } from "@/components/empty-production"
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
          <h2 className="font-heading text-lg font-medium">Autoberichte</h2>
          <p className="text-sm text-muted-foreground">
            Baut sich aus DuckDB neu, wenn Daten oder Filter wechseln. Diese
            Seite drucken oder als Textpaket exportieren.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
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
            Berichtspaket exportieren
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Drucken
          </Button>
        </div>
      </div>
      {files.length === 0 ? (
        <EmptyProduction
          title="Noch keine Berichte"
          description="Produktionsdateien laden, um Schicht-, Triage- und Serverberichte zu bauen."
        />
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
                Erzeugt {report.generatedAt}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
