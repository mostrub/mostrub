import { useRef } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  downloadAuditWorkbook,
  downloadBackup,
  downloadCsvPack,
  downloadPlantRegisterCsv,
  downloadPlantReportHtml,
  downloadRegisterCsv,
} from "@/export/download"
import { parseInventoryJson } from "@/store/storage"
import { useInventory } from "@/store/inventory-context"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

async function runExport(task: () => void | Promise<void>, success: string) {
  try {
    await task()
    toast.success(success)
  } catch {
    toast.error("Export fehlgeschlagen")
  }
}

export function ExportMenu() {
  const { state, replaceState, resetToEmpty, loadDemo } = useInventory()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) {
            return
          }
          const parsed = parseInventoryJson(await file.text())
          if (!parsed.ok) {
            toast.error(parsed.reason)
            return
          }
          if (!window.confirm("Aktuelles Inventar durch dieses Backup ersetzen?")) {
            return
          }
          const error = replaceState(parsed.state)
          if (error) {
            toast.error(error)
            return
          }
          toast.success("Backup übernommen")
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <DownloadIcon data-icon="inline-start" />
          Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Prüfexport</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadAuditWorkbook(state),
                  "Excel-Mappe heruntergeladen",
                )
              }}
            >
              Excel-Mappe (alle Blätter)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(() => downloadCsvPack(state), "CSV-Paket heruntergeladen")
              }}
            >
              CSV-Paket (Zip)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadPlantReportHtml(state),
                  "HTML-Bericht heruntergeladen",
                )
              }}
            >
              HTML-Bericht mit Diagrammen (PDF über Drucken)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadPlantRegisterCsv(state),
                  "Register-CSV heruntergeladen",
                )
              }}
            >
              Einfaches CSV (ein Blatt)
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Einzelnes CSV</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Laptops"),
                  "Laptops-CSV heruntergeladen",
                )
              }}
            >
              Laptops
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Laptops by department"),
                  "Abteilungs-CSV heruntergeladen",
                )
              }}
            >
              Laptops nach Abteilung
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Printers"),
                  "Drucker-CSV heruntergeladen",
                )
              }}
            >
              Drucker
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Software licenses"),
                  "Software-CSV heruntergeladen",
                )
              }}
            >
              Software
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Destruction log"),
                  "Vernichtungs-CSV heruntergeladen",
                )
              }}
            >
              Vernichtungsprotokoll
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Audit findings"),
                  "Befunde-CSV heruntergeladen",
                )
              }}
            >
              Prüfbefunde
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Device history"),
                  "Historie-CSV heruntergeladen",
                )
              }}
            >
              Gerätehistorie
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sicherung</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(() => downloadBackup(state), "JSON-Backup heruntergeladen")
              }}
            >
              JSON-Backup herunterladen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              JSON-Backup importieren
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (
                  !window.confirm(
                    "Alles im Browser löschen und mit einem leeren Register beginnen?",
                  )
                ) {
                  return
                }
                resetToEmpty()
                toast.success("Inventar geleert")
              }}
            >
              Inventar leeren (Datenverlust)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (
                  !window.confirm(
                    "Aktuelles Inventar vollständig durch die Werksdemo ersetzen?",
                  )
                ) {
                  return
                }
                loadDemo()
                toast.success("Werksdemo geladen")
              }}
            >
              Werksdemo laden (überschreibt alles)
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
