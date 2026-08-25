import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectionIngestSchema } from "../../packages/types/src/index.ts";
import { configFromEnv } from "../../packages/kernel/src/config.ts";
import { Ledger } from "../../packages/kernel/src/ledger.ts";
import { createPool, resetControlForTests } from "../../packages/kernel/src/postgres.ts";
import { resetLakeForTests } from "../../packages/kernel/src/lake.ts";
import { buildSeedRows } from "../../packages/kernel/src/seed.ts";

describe("shift analytics and seed", () => {
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

  it("builds a deterministic seed labeled source=seed", () => {
    const a = buildSeedRows("2026-08-24");
    const b = buildSeedRows("2026-08-24");
    expect(a.inspections).toHaveLength(72);
    expect(a.inspections.map((row) => row.dmc)).toEqual(b.inspections.map((row) => row.dmc));
    expect(a.inspections.every((row) => row.source === "seed")).toBe(true);
    expect(new Set(a.inspections.flatMap((row) => row.findings.map((f) => f.defectClass))).size).toBe(
      11,
    );
  });

  it("reports yield with a snapshot in provenance", async () => {
    if (!ledger) throw new Error("ledger missing");
    await ledger.seed("2026-08-24");
    const report = await ledger.shiftReport({
      from: "2026-08-24T00:00:00+02:00",
      to: "2026-08-25T00:00:00+02:00",
    });
    expect(report.inspected).toBe(72);
    expect(report.io + report.nio).toBe(72);
    expect(report.yield).toBe(report.io / report.inspected);
    expect(report._provenance.store).toBe("ducklake");
    expect(report._provenance.snapshotId).toBeGreaterThan(0);
    expect(report.defects.length).toBeGreaterThan(0);
    expect(report.day).toBe("2026-08-24");
    expect(report.hours.map((row) => row.hour).sort((a, b) => a - b)).toEqual([6, 14, 22]);
    expect(report.stations).toHaveLength(3);
    expect(report.nioCells).toHaveLength(report.nio);
    expect(report.spanWindow.p95).not.toBeNull();
    expect(await ledger.shiftDays()).toEqual(["2026-08-24"]);
    const chronik = await ledger.chronik({ limit: 10 });
    expect(chronik.events.length).toBeGreaterThan(0);
    expect(chronik.events[0]?.dmc.startsWith("HLL2-")).toBe(true);
    const line = await ledger.lineBoard();
    expect(line.stations).toHaveLength(3);
    expect(line.inspected).toBe(72);
    expect(line._provenance.query).toBe("line_board");
    expect(line.stations.some((station) => station.last.length > 0)).toBe(true);
    expect(line.hours.map((row) => row.hour).sort((a, b) => a - b)).toEqual([6, 14, 22]);
    expect(line.defects.length).toBe(11);
    expect(line.stations.every((station) => station.inspected > 0)).toBe(true);
    expect(line.trays).toHaveLength(3);
    expect(line.cells).toHaveLength(72);
    expect(line.spanWindow.p95).not.toBeNull();
    expect((line.spanWindow.p95 ?? 0) >= (line.spanWindow.p50 ?? 0)).toBe(true);
    const window = await ledger.latestShiftWindow();
    expect(window.from.startsWith("2026-08-24")).toBe(true);
    expect(line.cells.every((cell) => cell.source === "seed")).toBe(true);
  });

  it("uses the Zurich civil day, not UTC, for the latest shift", async () => {
    if (!ledger) throw new Error("ledger missing");
    await ledger.ingestInspections([
      inspectionIngestSchema.parse({
        dmc: "HLL2-TZ-0001",
        capturedAt: "2026-08-24T01:30:00+02:00",
        station: "oqc",
        tray: "T-1",
        slot: 1,
        partOk: true,
        source: "seed",
        measurements: { phiDeg: 0.1, widthMm: 11.5, heightMm: 5.4, spanMm: 0.04 },
        findings: [],
      }),
    ]);
    const window = await ledger.latestShiftWindow();
    expect(window.from.startsWith("2026-08-24")).toBe(true);
  });

  it("scopes a Schichtbericht to the asked Zurich day", async () => {
    if (!ledger) throw new Error("ledger missing");
    await ledger.seed("2026-08-24");
    await ledger.ingestInspections([
      inspectionIngestSchema.parse({
        dmc: "HLL2-20260823-0099",
        capturedAt: "2026-08-23T10:00:00+02:00",
        station: "oqc",
        tray: "T-9",
        slot: 1,
        partOk: false,
        source: "seed",
        measurements: { phiDeg: 0.1, widthMm: 11.5, heightMm: 5.4, spanMm: 0.2 },
        findings: [{ defectClass: "Span", score: 0.9 }],
      }),
    ]);
    const days = await ledger.shiftDays();
    expect(days).toEqual(["2026-08-24", "2026-08-23"]);
    const earlier = await ledger.shiftReport(ledger.shiftWindowForDay("2026-08-23"));
    expect(earlier.inspected).toBe(1);
    expect(earlier.nio).toBe(1);
    expect(earlier.nioCells[0]?.dmc).toBe("HLL2-20260823-0099");
    const latest = await ledger.shiftReport(await ledger.latestShiftWindow());
    expect(latest.inspected).toBe(72);
  });
});
