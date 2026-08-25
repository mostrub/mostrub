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
    toast.error("Export failed")
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
        accept="application/json"
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
          if (!window.confirm("Replace the current inventory with this backup?")) {
            return
          }
          replaceState(parsed.state)
          toast.success("Backup imported")
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <DownloadIcon data-icon="inline-start" />
          Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Consulting audit</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadAuditWorkbook(state),
                  "Excel workbook downloaded",
                )
              }}
            >
              Excel workbook (all tabs)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(() => downloadCsvPack(state), "CSV pack downloaded")
              }}
            >
              CSV pack (zip)
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Single CSV</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Laptops"),
                  "Laptops CSV downloaded",
                )
              }}
            >
              Laptops
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Laptops by department"),
                  "Department CSV downloaded",
                )
              }}
            >
              Laptops by department
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Printers"),
                  "Printers CSV downloaded",
                )
              }}
            >
              Printers
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Software licenses"),
                  "Software CSV downloaded",
                )
              }}
            >
              Software
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Destruction log"),
                  "Destruction CSV downloaded",
                )
              }}
            >
              Destruction log
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Audit findings"),
                  "Findings CSV downloaded",
                )
              }}
            >
              Audit findings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void runExport(
                  () => downloadRegisterCsv(state, "Device history"),
                  "History CSV downloaded",
                )
              }}
            >
              Device history
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Backup</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                void runExport(() => downloadBackup(state), "JSON backup downloaded")
              }}
            >
              Download JSON backup
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              Import JSON backup
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!window.confirm("Clear the current inventory and start empty?")) {
                  return
                }
                resetToEmpty()
                toast.success("Inventory cleared")
              }}
            >
              Reset to empty
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!window.confirm("Replace the current inventory with the plant demo?")) {
                  return
                }
                loadDemo()
                toast.success("Plant demo loaded")
              }}
            >
              Reload plant demo
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
