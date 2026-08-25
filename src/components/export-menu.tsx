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
  downloadAllCsv,
  downloadAuditWorkbook,
  downloadBackup,
  downloadRegisterCsv,
} from "@/export/download"
import { parseInventoryBackup } from "@/store/storage"
import { useInventory } from "@/store/inventory-context"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

export function ExportMenu() {
  const { state, replaceState } = useInventory()
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
          const text = await file.text()
          try {
            const parsed: unknown = JSON.parse(text)
            const next = parseInventoryBackup(parsed)
            if (!next) {
              toast.error("That file is not an inventory backup")
              return
            }
            replaceState(next)
            toast.success("Backup imported")
          } catch {
            toast.error("Could not read that JSON file")
          }
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
                void downloadAuditWorkbook(state).then(() => {
                  toast.success("Excel workbook downloaded")
                })
              }}
            >
              Excel workbook (all tabs)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadAllCsv(state)}>
              CSV pack (every tab)
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Single CSV</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => downloadRegisterCsv(state, "Laptops")}>
              Laptops
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => downloadRegisterCsv(state, "Laptops by department")}
            >
              Laptops by department
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadRegisterCsv(state, "Printers")}>
              Printers
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => downloadRegisterCsv(state, "Software licenses")}
            >
              Software
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => downloadRegisterCsv(state, "Destruction log")}
            >
              Destruction log
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => downloadRegisterCsv(state, "Audit findings")}
            >
              Audit findings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Backup</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => downloadBackup(state)}>
              Download JSON backup
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              Import JSON backup
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
