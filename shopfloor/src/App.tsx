import { AppShell } from "@/components/app-shell"
import { DashboardPage } from "@/pages/dashboard-page"
import { ExplorerPage } from "@/pages/explorer-page"
import { ExportPage } from "@/pages/export-page"
import { IngestPage } from "@/pages/ingest-page"
import { ReportsPage } from "@/pages/reports-page"
import { ServersPage } from "@/pages/servers-page"
import { TriagePage } from "@/pages/triage-page"
import { useFloorline } from "@/state/floorline-store"
import type { AppView } from "@/lib/types"

export function App() {
  const { view } = useFloorline()
  return <AppShell>{renderView(view)}</AppShell>
}

function renderView(view: AppView) {
  switch (view) {
    case "ingest":
      return <IngestPage />
    case "dashboard":
      return <DashboardPage />
    case "triage":
      return <TriagePage />
    case "servers":
      return <ServersPage />
    case "explorer":
      return <ExplorerPage />
    case "reports":
      return <ReportsPage />
    case "export":
      return <ExportPage />
    default: {
      const _exhaustive: never = view
      return _exhaustive
    }
  }
}

export default App
