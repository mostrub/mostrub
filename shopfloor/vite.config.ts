/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import netlify from "@netlify/vite-plugin"
import { defineConfig } from "vite"
import { lanInfoPlugin } from "./vite-plugin-lan-info.ts"

export default defineConfig({
  plugins: [react(), tailwindcss(), netlify(), lanInfoPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
})
