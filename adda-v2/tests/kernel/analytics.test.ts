import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    const chronik = await ledger.chronik({ limit: 10 });
    expect(chronik.events.length).toBeGreaterThan(0);
    expect(chronik.events[0]?.dmc.startsWith("HLL2-")).toBe(true);
    const line = await ledger.lineBoard();
    expect(line.stations).toHaveLength(3);
    expect(line.inspected).toBe(72);
    expect(line._provenance.query).toBe("line_board");
    expect(line.stations.some((station) => station.last.length > 0)).toBe(true);
    expect(line.hours.length).toBeGreaterThan(0);
    expect(line.defects.length).toBe(11);
    expect(line.stations.every((station) => station.inspected > 0)).toBe(true);
    const window = await ledger.latestShiftWindow();
    expect(window.from.startsWith("2026-08-24")).toBe(true);
  });
});
