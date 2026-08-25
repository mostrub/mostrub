import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { StorageGate } from "@/components/storage-gate"
import { AuditPage } from "@/pages/audit-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { DestructionPage } from "@/pages/destruction-page"
import { LaptopsPage } from "@/pages/laptops-page"
import { PrintersPage } from "@/pages/printers-page"
import { SoftwarePage } from "@/pages/software-page"

export function App() {
  return (
    <BrowserRouter>
      <StorageGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="laptops" element={<LaptopsPage />} />
            <Route path="printers" element={<PrintersPage />} />
            <Route path="software" element={<SoftwarePage />} />
            <Route path="destruction" element={<DestructionPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </StorageGate>
    </BrowserRouter>
  )
}

export default App
