import { useEffect, useState } from "react"
import {
  DatabaseIcon,
  DownloadIcon,
  FolderOpenIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sanitizeDbFileName } from "@/lib/duckdb/share-db"
import { useFloorline } from "@/state/floorline-store"

export function ShareDbCard() {
  const {
    files,
    loading,
    ready,
    canUseShareFolder,
    shareFolderName,
    shareFolderPermitted,
    shareDbNames,
    activeShareDbName,
    suggestedShareDbName,
    pickShareFolder,
    grantShareFolder,
    refreshShareDbs,
    saveShareDb,
    loadShareDb,
    downloadShareDb,
    loadShareDbFile,
  } = useFloorline()
  const [nameDraft, setNameDraft] = useState(
    suggestedShareDbName.replace(/\.floorline$/i, "")
  )
  const [nameDirty, setNameDirty] = useState(false)

  useEffect(() => {
    if (!nameDirty) {
      setNameDraft(suggestedShareDbName.replace(/\.floorline$/i, ""))
    }
  }, [nameDirty, suggestedShareDbName])

  const fileName = sanitizeDbFileName(nameDraft)
  const hasRows = files.length > 0
  const folderReady = shareFolderPermitted && shareFolderName !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle>DuckDB-Stand</CardTitle>
        <CardDescription>
          Den aktuellen Stand als <code>.floorline</code>-Datei auf eine Freigabe
          legen. Liegen mehrere Stände im Ordner, einen davon laden. Edge oder
          Chrome unter Windows schreibt direkt auf Z:\ oder UNC. Andere Browser:
          Datei herunterladen und später wieder laden.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activeShareDbName ? (
          <p className="text-sm">
            Aktiver Stand: <span className="font-medium">{activeShareDbName}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch kein gespeicherter Stand geladen.
          </p>
        )}
        {canUseShareFolder ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void pickShareFolder()}
              disabled={!ready || loading}
            >
              <FolderOpenIcon data-icon="inline-start" />
              Stand-Ordner wählen
            </Button>
            {shareFolderName && !shareFolderPermitted ? (
              <Button
                variant="outline"
                onClick={() => void grantShareFolder()}
                disabled={loading}
              >
                Zugriff erlauben
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => void refreshShareDbs()}
              disabled={!folderReady || loading}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Liste aktualisieren
            </Button>
            {shareFolderName ? (
              <span className="text-sm text-muted-foreground">
                Ordner: {shareFolderName}
                {shareFolderPermitted ? "" : " (Zugriff fehlt)"}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Kein Freigabeordner gewählt.
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Dieser Browser merkt sich keinen Freigabeordner. Stand-Datei
            herunterladen oder über den Dateidialog laden.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="floorline-db-name">Dateiname</Label>
          <Input
            id="floorline-db-name"
            value={nameDraft}
            onChange={(event) => {
              setNameDirty(true)
              setNameDraft(event.target.value)
            }}
            disabled={!ready || loading}
          />
          <p className="text-xs text-muted-foreground">{fileName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void saveShareDb(fileName)}
            disabled={!folderReady || !hasRows || loading}
          >
            <DatabaseIcon data-icon="inline-start" />
            Auf Freigabe speichern
          </Button>
          <Button
            variant="outline"
            onClick={() => void downloadShareDb(fileName)}
            disabled={!hasRows || loading}
          >
            <DownloadIcon data-icon="inline-start" />
            Datei herunterladen
          </Button>
          <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted has-disabled:pointer-events-none has-disabled:opacity-50">
            <UploadIcon className="size-4" />
            Stand-Datei laden
            <input
              type="file"
              accept=".floorline,.ddb"
              className="sr-only"
              disabled={!ready || loading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void loadShareDbFile(file)
                }
                event.target.value = ""
              }}
            />
          </label>
        </div>
        {canUseShareFolder ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Gefundene Stände</p>
            {shareDbNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {folderReady
                  ? "Keine .floorline- oder .ddb-Dateien in diesem Ordner."
                  : "Zuerst einen Freigabeordner wählen."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shareDbNames.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="truncate text-sm">
                      {name}
                      {name === activeShareDbName ? " · aktiv" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant={name === activeShareDbName ? "secondary" : "outline"}
                      disabled={loading}
                      onClick={() => void loadShareDb(name)}
                    >
                      Laden
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
