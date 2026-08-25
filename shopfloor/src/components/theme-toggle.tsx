import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      aria-label="Color theme"
      size="sm"
      value={[theme]}
      onValueChange={(value) => {
        const next = value[0]
        if (next === "light" || next === "dark" || next === "system") {
          setTheme(next)
        }
      }}
    >
      <ToggleGroupItem value="light" aria-label="Light mode">
        <SunIcon data-icon="inline-start" />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark mode">
        <MoonIcon data-icon="inline-start" />
        Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System theme">
        <MonitorIcon data-icon="inline-start" />
        System
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
