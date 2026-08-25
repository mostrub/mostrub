import { serve } from "@hono/node-server";
import { configFromEnv, Ledger } from "@ledger/kernel";
import { apiConfigFromEnv } from "./config.ts";
import { createApp } from "./app.ts";

const api = apiConfigFromEnv();
const ledger = await Ledger.open(configFromEnv());
const app = createApp(ledger, api);

const server = serve(
  {
    fetch: app.fetch,
    hostname: api.host,
    port: api.port,
  },
  (info) => {
    process.stdout.write(`ADDA light Schnittstelle ${info.address}:${info.port}\n`);
  },
);

const shutdown = async () => {
  server.close();
  await ledger.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
