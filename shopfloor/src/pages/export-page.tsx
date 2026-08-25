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
        <h2 className="font-heading text-lg font-medium">Export and share</h2>
        <p className="text-sm text-muted-foreground">
          DuckDB writes the current filter as CSV or Parquet. Share a URL that
          restores the same controllers and filters.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Share snapshot</CardTitle>
          <CardDescription>
            Hash includes the view and encoded filters. Data stays on this
            machine unless you also send a Parquet pack.
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
                  toast.success("Share URL copied")
                )
              }}
            >
              Copy share URL
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadShareCard({ url, filters })}
            >
              Download filter card
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Filtered tables</CardTitle>
          <CardDescription>
            COPY through DuckDB. Parquet is the default pack for historians.
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
          <CardTitle>XML share template</CardTitle>
          <CardDescription>
            Schema used by the demo pack. Point a Windows share drop at this
            shape, or keep camelCase / snake_case attributes.
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
            Download demo XML files
          </Button>
          <p className="text-xs text-muted-foreground">
            {files.length} files currently loaded. SQL example:{" "}
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
        <p className="text-xs text-muted-foreground">{args.count} rows</p>
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
