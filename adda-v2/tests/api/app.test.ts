import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configFromEnv, createPool, Ledger, resetControlForTests, resetLakeForTests } from "../../packages/kernel/src/index.ts";
import { createApp } from "../../apps/api/src/app.ts";
import { inspectionIngestSchema } from "../../packages/types/src/index.ts";

describe("ledger api", () => {
  let ledger: Ledger | undefined;

  beforeEach(async () => {
    const config = { ...configFromEnv(), metadataSchema: "ducklake_test" };
    await resetLakeForTests(config);
    const pool = createPool(config.pgUrl);
    await resetControlForTests(pool, config.pgUrl);
    await pool.end();
    ledger = await Ledger.open(config);
  });

  afterEach(async () => {
    await ledger?.close();
  });

  it("serves health and rejects ingest without a token", async () => {
    if (!ledger) throw new Error("missing ledger");
    const app = createApp(ledger, {
      host: "127.0.0.1",
      port: 5757,
      ingestToken: "secret",
      operatorToken: "op",
    });
    const health = await app.request("/health");
    expect(health.status).toBe(200);
    const body = (await health.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const denied = await app.request("/_internal/ingest/inspections", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(denied.status).toBe(401);
  });

  it("ingests a cell and opens a case", async () => {
    if (!ledger) throw new Error("missing ledger");
    const app = createApp(ledger, {
      host: "127.0.0.1",
      port: 5757,
      ingestToken: "secret",
      operatorToken: "op",
    });
    const payload = inspectionIngestSchema.parse({
      dmc: "HLL2-API-0001",
      capturedAt: "2026-08-24T06:15:00+02:00",
      station: "oqc",
      tray: "T-9",
      slot: 2,
      partOk: false,
      source: "seed",
      measurements: { phiDeg: 0.2, widthMm: 11.6, heightMm: 5.4, spanMm: 0.2 },
      findings: [{ defectClass: "Kratzer", score: 0.8 }],
    });
    const ingest = await app.request("/_internal/ingest/inspections", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: JSON.stringify(payload),
    });
    expect(ingest.status).toBe(201);

    const cell = await app.request("/api/cells/HLL2-API-0001");
    expect(cell.status).toBe(200);
    const dossier = (await cell.json()) as { inspections: unknown[] };
    expect(dossier.inspections).toHaveLength(1);

    const opened = await app.request("/api/cases", {
      method: "POST",
      headers: { Authorization: "Bearer op" },
      body: JSON.stringify({
        dmc: "HLL2-API-0001",
        title: "Kratzer",
        openedBy: "qg.meier",
      }),
    });
    expect(opened.status).toBe(201);
  });

  it("serves the line board after seed", async () => {
    if (!ledger) throw new Error("missing ledger");
    await ledger.seed("2026-08-24");
    const app = createApp(ledger, {
      host: "127.0.0.1",
      port: 5757,
      ingestToken: "secret",
      operatorToken: "op",
    });
    const line = await app.request("/api/linie");
    expect(line.status).toBe(200);
    const board = (await line.json()) as { inspected: number; stations: unknown[]; hours: unknown[] };
    expect(board.inspected).toBe(72);
    expect(board.stations).toHaveLength(3);
    expect(board.hours.length).toBeGreaterThan(0);

    const schicht = await app.request("/api/schicht");
    expect(schicht.status).toBe(200);
    const report = (await schicht.json()) as { inspected: number; from: string };
    expect(report.inspected).toBe(72);
    expect(report.from.startsWith("2026-08-24")).toBe(true);
  });
});
