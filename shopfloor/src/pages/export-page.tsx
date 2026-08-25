import { toast } from "sonner"

import { copyToClipboard, downloadText } from "@/lib/download"
import { sqlFrom } from "@/lib/filters"
import { buildShareSampleFiles } from "@/lib/xml/sample-production"
import { TABLE_NAMES, type TableName } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadShareCard, useFloorline } from "@/state/floorline-store"

export function ExportPage() {
  const { filters, exportTable, shareUrl, rowCounts, files } = useFloorline()
  const url = shareUrl()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Export und Freigabe</h2>
        <p className="text-sm text-muted-foreground">
          DuckDB schreibt den aktuellen Filter als CSV oder Parquet. Eine URL
          stellt dieselben Steuerungen und Filter wieder her.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Freigabe-Schnappschuss</CardTitle>
          <CardDescription>
            Der Hash enthält die Ansicht und die kodierten Filter. Die Daten
            bleiben auf diesem Rechner, außer Sie schicken zusätzlich ein
            Parquet-Paket.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <code className="block overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void copyToClipboard(url).then(() =>
                  toast.success("Freigabe-URL kopiert")
                )
              }}
            >
              Freigabe-URL kopieren
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadShareCard({ url, filters })}
            >
              Filterkarte herunterladen
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Gefilterte Tabellen</CardTitle>
          <CardDescription>
            COPY über DuckDB. Parquet ist das Standardpaket für Historien.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {TABLE_NAMES.map((table) => (
            <ExportRow
              key={table}
              table={table}
              count={rowCounts[table]}
              onExport={exportTable}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>XML-Freigabevorlage</CardTitle>
          <CardDescription>
            Schema des Demopakets. Windows-Freigabe auf diese Form legen oder
            camelCase- und snake_case-Attribute belassen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
{`<ShopfloorExport plant="AUSTIN" sourceShare="\\\\mes-aus-01\\production\\xml" shift="A">
  <Cycle id="..." line="CELL-1" station="ST-04" machine="CELL-1-ST-04"
         controller="PLC-CELL-1-ST-04" workOrder="WO-1" sku="CELL-2170"
         result="PASS" cycleMs="11000" targetCycleMs="11000" ... />
  <Downtime ... category="UNPLANNED" reasonCode="STARVE" />
  <Alarm ... severity="CRITICAL" />
  <ServerSample serverId="SRV-AUS-CELL-1-MES" role="MES" cpuPct="42" ... />
  <Controller id="PLC-CELL-1-ST-04" vendor="Siemens" scanMsP95="14.1" runMode="RUN" />
</ShopfloorExport>`}
          </pre>
          <Button
            variant="outline"
            onClick={() => {
              const filesXml = buildShareSampleFiles()
              for (const file of filesXml) {
                downloadText({
                  text: file.xml,
                  fileName: file.fileName,
                  mime: "text/xml",
                })
              }
            }}
          >
            Demo-XML herunterladen
          </Button>
          <p className="text-xs text-muted-foreground">
            {files.length} Dateien geladen. SQL-Beispiel:{" "}
            <code>SELECT * FROM {sqlFrom("cycles", filters)}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ExportRow(args: {
  table: TableName
  count: number
  onExport: (args: { table: TableName; format: "csv" | "parquet" }) => Promise<void>
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div>
        <p className="font-mono text-sm">{args.table}</p>
        <p className="text-xs text-muted-foreground">{args.count} Zeilen</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={args.count === 0}
          onClick={() => void args.onExport({ table: args.table, format: "csv" })}
        >
          CSV
        </Button>
        <Button
          size="sm"
          disabled={args.count === 0}
          onClick={() =>
            void args.onExport({ table: args.table, format: "parquet" })
          }
        >
          Parquet
        </Button>
      </div>
    </div>
  )
}
