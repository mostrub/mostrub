import { DownloadIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

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
import { AUDIT_SHEET_NAMES } from "@/export/workbook"
import { parseInventoryJson } from "@/store/storage"
import { useInventory } from "@/store/inventory-context"

const REGISTER_CSVS: {
  name: (typeof AUDIT_SHEET_NAMES)[number]
  label: string
  toast: string
}[] = [
  { name: "Laptops", label: "Laptops", toast: "Laptops-CSV heruntergeladen" },
  {
    name: "Laptops by department",
    label: "Laptops nach Abteilung",
    toast: "Abteilungs-CSV heruntergeladen",
  },
  { name: "Printers", label: "Drucker", toast: "Drucker-CSV heruntergeladen" },
  {
    name: "Software licenses",
    label: "Software",
    toast: "Software-CSV heruntergeladen",
  },
  {
    name: "Destruction log",
    label: "Vernichtungsprotokoll",
    toast: "Vernichtungs-CSV heruntergeladen",
  },
  {
    name: "Audit findings",
    label: "Prüfbefunde",
    toast: "Befunde-CSV heruntergeladen",
  },
  {
    name: "Device history",
    label: "Gerätehistorie",
    toast: "Historie-CSV heruntergeladen",
  },
]

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
            {REGISTER_CSVS.map((item) => (
              <DropdownMenuItem
                key={item.name}
                onClick={() => {
                  void runExport(() => downloadRegisterCsv(state, item.name), item.toast)
                }}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
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
                const error = resetToEmpty()
                if (error) {
                  toast.error(error)
                  return
                }
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
                const error = loadDemo()
                if (error) {
                  toast.error(error)
                  return
                }
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
