import { useEffect } from "react"

import { reportPresence } from "@/lib/lan"

export function PresenceBeacon() {
  useEffect(() => {
    void reportPresence()
    const timer = window.setInterval(() => {
      void reportPresence()
    }, 30_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return null
}
