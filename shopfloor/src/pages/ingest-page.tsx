import { useState } from "react"
import { FolderUpIcon, HardDriveIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DataTable } from "@/components/data-table"
import { ShareDbCard } from "@/components/share-db-card"
import { useFloorline } from "@/state/floorline-store"
import { sampleFileBlobs } from "@/lib/xml/sample-production"
import { downloadText } from "@/lib/download"

export function IngestPage() {
  const { ingestFiles, ingestDemo, clearData, files, error, loading, ready } =
    useFloorline()
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h2 className="font-heading text-lg font-medium">Produktionsdateien laden</h2>
        <p className="text-sm text-muted-foreground">
          XML aus der Freigabe, einem Ordner oder CSV/Parquet aus dieser App
          ablegen. Floorline liest <code>ShopfloorExport</code> mit Cycle,
          Downtime, Alarm, ServerSample und Controller — Attribute oder
          Kindknoten, auch mit Namensraum. Eine SAP-Datei in derselben Form
          einfach ablegen. Passt die Datei nicht, bleibt sie hier mit einer
          Fehlermeldung. DuckDB-Stände als <code>.floorline</code> auf die
          Freigabe legen. Start und Stopp über die Desktop-Symbole.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Ladefehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card
        className={dragOver ? "ring-2 ring-ring" : undefined}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const dropped = [...event.dataTransfer.files]
          if (dropped.length > 0) {
            void ingestFiles(dropped)
          }
        }}
      >
        <CardHeader>
          <CardTitle>Dateien hier ablegen</CardTitle>
          <CardDescription>
            Unter Windows zum gemappten Laufwerk, etwa Z:\produktion\xml.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <FolderUpIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              XML-Dateien wählen
            </span>
            <input
              type="file"
              accept=".xml,.csv,.parquet,.pq,.floorline,.ddb,text/xml,application/xml,text/csv"
              multiple
              className="sr-only"
              onChange={(event) => {
                const list = event.target.files
                if (list && list.length > 0) {
                  void ingestFiles([...list])
                }
              }}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm">
            Freigabeordner wählen
            <input
              type="file"
              multiple
              className="sr-only"
              {...{ webkitdirectory: "", directory: "" }}
              onChange={(event) => {
                const list = event.target.files
                if (list && list.length > 0) {
                  void ingestFiles([...list])
                }
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void ingestDemo()}
              disabled={!ready || loading}
            >
              <HardDriveIcon data-icon="inline-start" />
              Demo-Produktion laden
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                for (const file of sampleFileBlobs()) {
                  void file.text().then((xml) =>
                    downloadText({
                      text: xml,
                      fileName: file.name,
                      mime: "text/xml",
                    })
                  )
                }
              }}
            >
              Demo-XML herunterladen
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    "Das löscht den lokalen Stand auf diesem Rechner. Weiter?"
                  )
                ) {
                  void clearData()
                }
              }}
              disabled={files.length === 0 || loading}
            >
              <Trash2Icon data-icon="inline-start" />
              Geladene Daten löschen
            </Button>
          </div>
        </CardContent>
      </Card>
      <ShareDbCard />
      <Card>
        <CardHeader>
          <CardTitle>Geladene Dateien</CardTitle>
          <CardDescription>
            Jede Datei wird zu Produktion, Stillstand, Alarmen und Serverzeilen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            emptyLabel="Noch keine Dateien geladen."
            rows={files.map((file) => ({
              file_name: file.file_name,
              plant: file.plant,
              shift: file.shift,
              source_share: file.source_share,
              cycles: file.cycle_count,
              downtime: file.downtime_count,
              alarms: file.alarm_count,
              servers: file.server_sample_count,
              controllers: file.controller_count,
              status: file.status,
              error_message: file.error_message,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
