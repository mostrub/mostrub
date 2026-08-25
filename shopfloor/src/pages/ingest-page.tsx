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
        <h2 className="font-heading text-lg font-medium">Load production files</h2>
        <p className="text-sm text-muted-foreground">
          Drop XML from the share, a folder, or CSV/Parquet exported from this
          app. A refresh keeps the last load on this PC. Start and stop with
          the Desktop Floorline icons.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Ingest error</AlertTitle>
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
          <CardTitle>Drop files here</CardTitle>
          <CardDescription>
            On Windows, browse to a mapped drive such as Z:\production\xml.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <FolderUpIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              Choose XML files
            </span>
            <input
              type="file"
              accept=".xml,.csv,.parquet,.pq,text/xml,application/xml,text/csv"
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
            Choose a share folder
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
              Load demo production
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
              Download sample XML pack
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    "This removes the local snapshot on this PC. Continue?"
                  )
                ) {
                  void clearData()
                }
              }}
              disabled={files.length === 0 || loading}
            >
              <Trash2Icon data-icon="inline-start" />
              Clear loaded data
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ingested files</CardTitle>
          <CardDescription>
            Each file becomes production, downtime, alarm, and server rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            emptyLabel="No files loaded yet."
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
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
