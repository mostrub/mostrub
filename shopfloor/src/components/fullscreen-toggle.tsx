import { useEffect, useState } from "react"
import { MaximizeIcon, MinimizeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function FullscreenToggle() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => {
      setActive(document.fullscreenElement !== null)
    }
    sync()
    document.addEventListener("fullscreenchange", sync)
    return () => {
      document.removeEventListener("fullscreenchange", sync)
    }
  }, [])

  return (
    <Button
      size="sm"
      variant="outline"
      aria-pressed={active}
      aria-label={active ? "Exit full screen" : "Full screen"}
      onClick={() => {
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          return
        }
        void document.documentElement.requestFullscreen()
      }}
    >
      {active ? (
        <MinimizeIcon data-icon="inline-start" />
      ) : (
        <MaximizeIcon data-icon="inline-start" />
      )}
      {active ? "Exit" : "Full screen"}
    </Button>
  )
}
