import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { InventoryProvider } from "@/store/inventory-context"

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element missing")
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <InventoryProvider>
          <App />
          <Toaster />
        </InventoryProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
