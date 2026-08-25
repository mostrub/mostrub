import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_LEDGER_OPERATOR_TOKEN": JSON.stringify(
      process.env.LEDGER_OPERATOR_TOKEN ?? process.env.VITE_LEDGER_OPERATOR_TOKEN ?? "",
    ),
  },
  server: {
    host: process.env.LEDGER_WEB_HOST ?? "0.0.0.0",
    port: Number(process.env.LEDGER_WEB_PORT ?? "5759"),
    proxy: {
      "/api": "http://127.0.0.1:5757",
      "/health": "http://127.0.0.1:5757",
    },
  },
});
