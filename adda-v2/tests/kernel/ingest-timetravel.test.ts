import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  inspectionIngestSchema,
  lineEventIngestSchema,
  parseDmc,
} from "../../packages/types/src/index.ts";
import { configFromEnv } from "../../packages/kernel/src/config.ts";
import { Ledger } from "../../packages/kernel/src/ledger.ts";
import { resetControlForTests } from "../../packages/kernel/src/postgres.ts";
import { resetLakeForTests } from "../../packages/kernel/src/lake.ts";
import { createPool } from "../../packages/kernel/src/postgres.ts";

const dmc = parseDmc("HLL2-TIME-0001");

function inspection(partOk: boolean, capturedAt: string) {
  return inspectionIngestSchema.parse({
    dmc,
    capturedAt,
    station: "oqc",
    tray: "T-1",
    slot: 4,
    partOk,
    source: "seed",
    measurements: { phiDeg: 0.1, widthMm: 11.5, heightMm: 5.4, spanMm: partOk ? 0.05 : 0.22 },
    findings: partOk ? [] : [{ defectClass: "Span", score: 0.91 }],
  });
}

describe("ingest and time travel", () => {
  let ledger: Ledger | undefined;

  beforeEach(async () => {
    const config = {
      ...configFromEnv(),
      metadataSchema: "ducklake_test",
    };
    await resetLakeForTests(config);
    const pool = createPool(config.pgUrl);
    await resetControlForTests(pool, config.pgUrl);
    await pool.end();
    ledger = await Ledger.open(config);
  });

  afterEach(async () => {
    await ledger?.close();
  });

  it("keeps the first NIO visible at the pinned snapshot after a later IO row", async () => {
    if (!ledger) throw new Error("ledger missing");
    const first = await ledger.ingestInspections([
      inspection(false, "2026-08-24T06:10:00+02:00"),
    ]);
    await ledger.ingestLineEvents([
      lineEventIngestSchema.parse({
        dmc,
        observedAt: "2026-08-24T06:10:02+02:00",
        verdict: "nio",
        source: "seed",
      }),
    ]);
    await ledger.ingestInspections([inspection(true, "2026-08-24T14:10:00+02:00")]);

    const live = await ledger.loadDossier(dmc);
    expect(live.inspections).toHaveLength(2);
    expect(live.inspections[1]?.partOk).toBe(true);

    const pinned = await ledger.loadDossierAt(dmc, first.snapshotId);
    expect(pinned.inspections).toHaveLength(1);
    expect(pinned.inspections[0]?.partOk).toBe(false);
    expect(pinned.inspections[0]?.findings[0]?.defectClass).toBe("Span");
    expect(pinned._provenance.snapshotId).toBe(first.snapshotId);
  });

  it("opens a case, pins the lake, and closes scrap", async () => {
    if (!ledger) throw new Error("ledger missing");
    const ingested = await ledger.ingestInspections([
      inspection(false, "2026-08-24T06:20:00+02:00"),
    ]);
    const opened = await ledger.openCase({
      dmc,
      title: "Span an OQC",
      openedBy: "qg.meier",
    });
    expect(opened.status).toBe("open");
    const pinned = await ledger.pinCase(opened.id, ingested.snapshotId, {
      label: "vor der Nacharbeit",
      pinnedBy: "qg.meier",
    });
    expect(pinned.status).toBe("pinned");
    expect(pinned.snapshotId).toBe(ingested.snapshotId);
    const closed = await ledger.addDisposition(opened.id, {
      decision: "scrap",
      note: "Span über der Toleranz, Zelle ausgeschieden.",
      decidedBy: "qg.meier",
    });
    expect(closed.status).toBe("closed");
    expect(closed.dispositions[0]?.decision).toBe("scrap");
  });
});
