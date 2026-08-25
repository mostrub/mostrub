import type { ReactNode } from "react"
import {
  ActivityIcon,
  DatabaseIcon,
  FileDownIcon,
  FilterIcon,
  FactoryIcon,
  LayoutDashboardIcon,
  ServerIcon,
  TableIcon,
  UploadIcon,
} from "lucide-react"

import { APP_VIEWS, type AppView } from "@/lib/types"
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
  { label: string; icon: typeof UploadIcon }
> = {
  ingest: { label: "Ingest", icon: UploadIcon },
  dashboard: { label: "Dashboard", icon: LayoutDashboardIcon },
  triage: { label: "Drill & triage", icon: FilterIcon },
  servers: { label: "Servers", icon: ServerIcon },
  explorer: { label: "Explorer", icon: TableIcon },
  reports: { label: "Reports", icon: ActivityIcon },
  export: { label: "Export", icon: FileDownIcon },
}

export function AppShell({ children }: { children: ReactNode }) {
  const { view, setView, ready, loading, rowCounts, files, filterCount } =
    useFloorline()

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <FactoryIcon className="size-5" />
        <div className="min-w-0">
          <h1 className="text-sm font-medium tracking-tight">Floorline</h1>
          <p className="truncate text-xs text-muted-foreground">
            Local shopfloor production · DuckDB-WASM
          </p>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {APP_VIEWS.map((id) => {
            const meta = VIEW_META[id]
            const Icon = meta.icon
            return (
              <Button
                key={id}
                size="sm"
                variant={view === id ? "default" : "ghost"}
                onClick={() => setView(id)}
              >
                <Icon data-icon="inline-start" />
                {meta.label}
              </Button>
            )
          })}
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <LanShare />
          <FullscreenToggle />
          <Badge variant="outline">
            <DatabaseIcon data-icon="inline-start" />
            {ready ? "DuckDB ready" : "starting"}
          </Badge>
          <Badge variant="secondary">{files.length} files</Badge>
          <Badge variant="secondary">{rowCounts.cycles} cycles</Badge>
          <Badge variant="outline">{filterCount} filters</Badge>
          {loading ? <Badge>working</Badge> : null}
        </div>
      </header>
      <FilterChips />
      <div className="flex min-h-0 flex-1">
        {view === "ingest" ? null : <FilterRail />}
        <main className="min-w-0 flex-1 overflow-auto p-4 print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
