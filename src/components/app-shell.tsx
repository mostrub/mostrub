import { NavLink, Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
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

function registerTitle(pathname: string): string {
  const match = NAV.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
  return match?.label ?? "Overview"
}

export function AppShell() {
  const location = useLocation()
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
            Plant floor
          </p>
          <p className="text-sm font-semibold">{ORG_NAME}</p>
          <p className="text-xs text-muted-foreground">Asset register</p>
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
            <span className="text-muted-foreground">Register</span>
            <span className="px-1.5 text-muted-foreground">/</span>
            <span className="font-medium">{registerTitle(location.pathname)}</span>
          </p>
          <div className="ml-auto flex items-center gap-1.5">
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
        <main className="min-h-0 flex-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
