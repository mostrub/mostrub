import { useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { parseInventoryJson } from "@/store/storage"
import { useInventory } from "@/store/inventory-context"

export function StorageGate({ children }: { children: React.ReactNode }) {
  const { storageError, resetToEmpty, loadDemo, replaceState } = useInventory()
  const fileRef = useRef<HTMLInputElement>(null)

  if (!storageError) {
    return children
  }

  return (
    <div className="flex min-h-screen min-w-[1180px] items-center justify-center bg-background p-8">
      <Card className="w-[560px] rounded-sm">
        <CardHeader>
          <CardTitle>Gespeichertes Inventar konnte nicht gelesen werden</CardTitle>
          <CardDescription>
            Der Bestand in diesem Browser blieb unverändert. Er wurde nicht durch
            die Werksdemo ersetzt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{storageError}</p>
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
              const error = replaceState(parsed.state)
              if (error) {
                toast.error(error)
                return
              }
              toast.success("Backup übernommen")
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fileRef.current?.click()}>Backup importieren</Button>
            <Button variant="outline" onClick={resetToEmpty}>
              Leer starten
            </Button>
            <Button variant="outline" onClick={loadDemo}>
              Werksdemo laden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
