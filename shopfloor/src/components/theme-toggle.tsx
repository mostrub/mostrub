import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

const ORDER = ["light", "dark", "system"] as const

function themeLabel(theme: (typeof ORDER)[number]): string {
  switch (theme) {
    case "light":
      return "Hell"
    case "dark":
      return "Dunkel"
    case "system":
      return "Automatisch"
    default: {
      const _exhaustive: never = theme
      return _exhaustive
    }
  }
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "dark"

  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={`Farbschema ${themeLabel(theme)}. Klick für ${themeLabel(next)}`}
      onClick={() => setTheme(next)}
    >
      {theme === "light" ? <SunIcon /> : null}
      {theme === "dark" ? <MoonIcon /> : null}
      {theme === "system" ? <MonitorIcon /> : null}
    </Button>
  )
}
