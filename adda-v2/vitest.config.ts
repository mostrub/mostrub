import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      LEDGER_PG_URL: "postgres://ledger:ledger@127.0.0.1:5432/ledger_test",
      LEDGER_LAKE_PATH: "/tmp/ledger-test-lake",
      TZ: "Europe/Zurich",
    },
  },
});
