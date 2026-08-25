import { useState } from "react"
import { Share2Icon } from "lucide-react"
import { toast } from "sonner"

import { copyToClipboard } from "@/lib/download"
import {
  attachShareHash,
  buildJoinMessage,
  fetchLanShare,
  formatPeerLabel,
  hostOperatingSystemLabel,
  uniqueOperatingSystems,
  type LanShareInfo,
} from "@/lib/lan"
import { useFloorline } from "@/state/floorline-store"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export function LanShare() {
  const { shareUrl } = useFloorline()
  const [info, setInfo] = useState<LanShareInfo | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadInfo(): Promise<void> {
    setLoading(true)
    try {
      setInfo(await fetchLanShare())
    } finally {
      setLoading(false)
    }
  }

  const hostOs = info
    ? hostOperatingSystemLabel(info.platform, info.os)
    : "dieser Rechner"
  const systems = info ? uniqueOperatingSystems(info.peers) : []

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          void loadInfo()
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline" aria-label="Im Netzwerk freigeben" />
        }
      >
        <Share2Icon data-icon="inline-start" />
        Freigabe
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Diese Instanz teilen</PopoverTitle>
          <PopoverDescription>
            Öffnet dieselbe Seite und dieselben Filter im LAN. Die Daten
            bleiben auf diesem Rechner.
          </PopoverDescription>
        </PopoverHeader>
        {loading && !info ? (
          <p className="text-muted-foreground text-xs">LAN-Adressen werden gesucht…</p>
        ) : null}
        {info ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs">
              Host <span className="font-medium">{info.hostname}</span> ist{" "}
              {hostOs}. Dieser Browser ist {info.visitorOs}.
            </p>
            {systems.length > 0 ? (
              <p className="text-xs">
                Betriebssysteme auf dieser Instanz:{" "}
                <span className="font-medium">{systems.join(", ")}</span>
              </p>
            ) : null}
            <ul className="flex flex-col gap-1">
              {info.urls.map((url) => (
                <li key={url}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-auto w-full justify-start whitespace-normal px-2 py-1 text-left text-xs"
                    onClick={() => {
                      void copyToClipboard(attachShareHash(url, shareUrl())).then(
                        () => toast.success("LAN-URL kopiert")
                      )
                    }}
                  >
                    {attachShareHash(url, shareUrl())}
                  </Button>
                </li>
              ))}
            </ul>
            {info.peers.length > 0 ? (
              <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                {info.peers.map((peer) => (
                  <li key={`${peer.role}-${peer.ip}-${peer.os}`}>
                    {formatPeerLabel(peer)}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void copyToClipboard(
                  buildJoinMessage({
                    ...info,
                    urls: info.urls.map((url) =>
                      attachShareHash(url, shareUrl())
                    ),
                  })
                ).then(() =>
                  toast.success("Beitrittstext kopiert")
                )
              }}
            >
              Beitrittstext kopieren
            </Button>
            <p className="text-muted-foreground text-xs">
              Wenn ein anderer Rechner nicht verbindet, Floorline über das
              Desktop-Symbol starten, damit es im Netz lauscht, und die
              Adresse erneut versuchen.
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
