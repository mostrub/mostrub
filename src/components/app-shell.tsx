import { NavLink, Outlet } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ExportMenu } from "@/components/export-menu"
import { useTheme } from "@/components/theme-provider"
import { ORG_NAME } from "@/domain/seed"
import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "lucide-react"

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/laptops", label: "Laptops" },
  { to: "/printers", label: "Printers" },
  { to: "/software", label: "Software" },
  { to: "/destruction", label: "Destruction" },
  { to: "/audit", label: "Audit" },
]

export function AppShell() {
  const { theme, setTheme } = useTheme()
  const resolvedDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-1 px-4 py-5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            IT operations
          </p>
          <p className="font-heading text-base font-medium">{ORG_NAME}</p>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-sm",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ExportMenu />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedDark ? "light" : "dark")}
            >
              {resolvedDark ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
