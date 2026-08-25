import type { ReactNode } from "react"
import {
  ActivityIcon,
  DatabaseIcon,
  FileDownIcon,
  FilterIcon,
  FactoryIcon,
  LayoutDashboardIcon,
  LayersIcon,
  DollarSignIcon,
  ServerIcon,
  TableIcon,
  UploadIcon,
} from "lucide-react"

import { APP_VIEWS, type AppView } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FilterChips } from "@/components/filter-chips"
import { FilterRail } from "@/components/filter-rail"
import { FullscreenToggle } from "@/components/fullscreen-toggle"
import { LanShare } from "@/components/lan-share"
import { ThemeToggle } from "@/components/theme-toggle"
import { useFloorline } from "@/state/floorline-store"

const VIEW_META: Record<
  AppView,
  { label: string; short: string; icon: typeof UploadIcon }
> = {
  ingest: { label: "Ingest", short: "Ingest", icon: UploadIcon },
  dashboard: { label: "Dashboard", short: "Dash", icon: LayoutDashboardIcon },
  triage: { label: "Drill & triage", short: "Drill", icon: FilterIcon },
  olap: { label: "OLAP", short: "OLAP", icon: LayersIcon },
  pricing: { label: "Pricing", short: "Price", icon: DollarSignIcon },
  servers: { label: "Servers", short: "Servers", icon: ServerIcon },
  explorer: { label: "Tables", short: "Tables", icon: TableIcon },
  reports: { label: "Reports", short: "Reports", icon: ActivityIcon },
  export: { label: "Export", short: "Export", icon: FileDownIcon },
}

const HIDE_RAIL: AppView[] = ["ingest", "dashboard", "export"]

export function AppShell({ children }: { children: ReactNode }) {
  const {
    view,
    setView,
    ready,
    loading,
    rowCounts,
    files,
    filterCount,
    error,
    restoreFailed,
    dismissRestoreFailed,
    ingestDemo,
  } = useFloorline()
  const showRail = !HIDE_RAIL.includes(view)

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-1.5">
        <FactoryIcon className="size-5 shrink-0" />
        <div className="hidden min-w-0 sm:block">
          <h1 className="text-sm font-medium tracking-tight">Floorline</h1>
        </div>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <nav className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto">
          {APP_VIEWS.map((id) => {
            const meta = VIEW_META[id]
            const Icon = meta.icon
            return (
              <Button
                key={id}
                size="sm"
                variant={view === id ? "default" : "ghost"}
                className="shrink-0"
                onClick={() => setView(id)}
              >
                <Icon data-icon="inline-start" />
                <span className="hidden md:inline">{meta.label}</span>
                <span className="md:hidden">{meta.short}</span>
              </Button>
            )
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <LanShare />
          <FullscreenToggle />
          <Badge variant="outline" className="hidden lg:inline-flex">
            <DatabaseIcon data-icon="inline-start" />
            {ready ? "Ready" : "starting"}
          </Badge>
          <Badge variant="secondary">
            {files.length} files · {rowCounts.cycles} cycles
          </Badge>
          {filterCount > 0 ? (
            <Badge variant="outline">{filterCount} filters</Badge>
          ) : null}
          {loading ? <Badge>working</Badge> : null}
        </div>
      </header>
      {error ? (
        <Alert variant="destructive" className="mx-3 mt-2 print:hidden">
          <AlertTitle>Could not start Floorline</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {restoreFailed.length > 0 ? (
        <Alert variant="destructive" className="mx-3 mt-2 print:hidden">
          <AlertTitle>Could not restore {restoreFailed.join(", ")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Load the last XML drop or the demo pack.
            <Button size="sm" onClick={() => void ingestDemo()}>
              Load demo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setView("ingest")}>
              Go to Ingest
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissRestoreFailed}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <FilterChips />
      <div className="flex min-h-0 flex-1">
        {showRail ? <FilterRail /> : null}
        <main className="min-w-0 flex-1 overflow-auto p-4 print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
