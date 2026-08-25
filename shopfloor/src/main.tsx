import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { FloorlineProvider } from "@/state/floorline-store"

const root = document.getElementById("root")
if (!root) {
    throw new Error("Wurzelelement fehlt")
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <FloorlineProvider>
          <App />
          <Toaster />
        </FloorlineProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
