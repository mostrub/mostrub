import { describe, expect, it } from "vitest";
import {
  DEFECT_CLASSES,
  inspectionIngestSchema,
  isDefectClass,
  lineEventIngestSchema,
  parseDmc,
} from "../../packages/types/src/index.ts";

describe("defect register", () => {
  it("accepts the eleven HLL-2 classes and rejects unknown names", () => {
    expect(DEFECT_CLASSES).toHaveLength(11);
    expect(isDefectClass("Span")).toBe(true);
    expect(isDefectClass("span")).toBe(false);
    expect(isDefectClass("capacity-fade")).toBe(false);
  });
});

describe("parseDmc", () => {
  it("brands a DMC and maps a blank code to KEIN_DMC", () => {
    const dmc = parseDmc(" Renata-HLL2-0001 ");
    expect(dmc).toBe("Renata-HLL2-0001");
    expect(parseDmc("")).toBe("KEIN_DMC");
    expect(parseDmc("   ")).toBe("KEIN_DMC");
  });
});

describe("ingest schemas", () => {
  it("rejects an inspection whose finding is not a defect class", () => {
    const parsed = inspectionIngestSchema.safeParse({
      dmc: "A1",
      capturedAt: "2026-08-25T06:00:00+02:00",
      station: "oqc",
      tray: "T-1",
      slot: 1,
      partOk: false,
      measurements: { phiDeg: 0, widthMm: 11.5, heightMm: 5.4, spanMm: 0.12 },
      findings: [{ defectClass: "BMS", score: 0.9 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a line event with a known verdict", () => {
    const parsed = lineEventIngestSchema.parse({
      dmc: "A1",
      observedAt: "2026-08-25T06:00:01+02:00",
      verdict: "nio",
    });
    expect(parsed.verdict).toBe("nio");
    expect(parsed.dmc).toBe("A1");
  });
});
