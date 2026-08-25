import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExportMenu } from "@/components/export-menu"
import { useTheme } from "@/components/theme-provider"
import { ORG_NAME } from "@/domain/seed"
import { historyHref } from "@/lib/hardware-links"
import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "lucide-react"

const NAV = [
  { to: "/", label: "Übersicht", end: true },
  { to: "/laptops", label: "Laptops" },
  { to: "/printers", label: "Drucker" },
  { to: "/software", label: "Software" },
  { to: "/destruction", label: "Vernichtung" },
  { to: "/history", label: "Historie" },
  { to: "/audit", label: "Prüfung" },
]

function registerTitle(pathname: string): string {
  const match = NAV.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
  return match?.label ?? "Übersicht"
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [lookup, setLookup] = useState("")
  const { theme, setTheme } = useTheme()
  const resolvedDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="flex min-h-screen min-w-[1180px] bg-background">
      <aside className="flex w-52 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="border-b px-3 py-3">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Werkhalle
          </p>
          <p className="text-sm font-semibold">{ORG_NAME}</p>
          <p className="text-xs text-muted-foreground">Anlagenregister</p>
        </div>
        <nav className="flex flex-col py-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "border-l-2 px-3 py-1.5 text-sm",
                  isActive
                    ? "border-foreground bg-sidebar-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center gap-3 border-b bg-muted/40 px-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Bestand</span>
            <span className="px-1.5 text-muted-foreground">/</span>
            <span className="font-medium">{registerTitle(location.pathname)}</span>
          </p>
          <form
            className="ml-auto flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              const needle = lookup.trim()
              if (needle) {
                navigate(historyHref(needle))
              }
            }}
          >
            <Input
              className="h-8 w-56"
              placeholder="Inv.-Nr., Kennzeichen, Serie"
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              aria-label="Gerät in der Historie suchen"
            />
            <Button type="submit" variant="outline" size="sm">
              Suchen
            </Button>
          </form>
          <div className="flex items-center gap-1.5">
            <ExportMenu />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Darstellung wechseln"
              onClick={() => setTheme(resolvedDark ? "light" : "dark")}
            >
              {resolvedDark ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
