import {
  DEFECT_CLASSES,
  inspectionIngestSchema,
  lineEventIngestSchema,
  parseDmc,
  type InspectionIngest,
  type LineEventIngest,
} from "@ledger/types";
import { ingestInspections, ingestLineEvents } from "./ingest.ts";
import { newAuditId } from "./ids.ts";
import type { Lake } from "./lake.ts";
import type { ControlStore } from "./postgres.ts";

export type SeedResult = {
  inspections: number;
  lineEvents: number;
  dmcs: string[];
};

export async function seedLedger(
  lake: Lake,
  control: ControlStore,
  options: { day: string },
): Promise<SeedResult> {
  const rows = buildSeedRows(options.day);
  await ingestInspections(lake, rows.inspections, "seed");
  await ingestLineEvents(lake, rows.lineEvents, "seed");
  await control.writeAudit({
    id: newAuditId(),
    at: new Date(),
    actor: "seed",
    action: "seed",
    payload: { day: options.day, inspections: rows.inspections.length },
  });
  return {
    inspections: rows.inspections.length,
    lineEvents: rows.lineEvents.length,
    dmcs: [...new Set(rows.inspections.map((row) => row.dmc))],
  };
}

export function buildSeedRows(day: string): {
  inspections: InspectionIngest[];
  lineEvents: LineEventIngest[];
} {
  const rng = mulberry32(hashDay(day));
  const inspections: InspectionIngest[] = [];
  const lineEvents: LineEventIngest[] = [];
  const shifts = ["06:00:00", "14:00:00", "22:00:00"] as const;

  let cell = 1;
  for (const [shiftIndex, start] of shifts.entries()) {
    for (let n = 0; n < 24; n += 1) {
      const dmc = parseDmc(`HLL2-${day.replaceAll("-", "")}-${String(cell).padStart(4, "0")}`);
      cell += 1;
      const nio = n % 6 === 0 || (shiftIndex === 0 && n < DEFECT_CLASSES.length);
      const defect = DEFECT_CLASSES[n % DEFECT_CLASSES.length];
      if (!defect) {
        throw new Error("defect register empty");
      }
      const capturedAt = `${day}T${offsetTime(start, n * 90)}+02:00`;
      const inspection = inspectionIngestSchema.parse({
        dmc,
        capturedAt,
        station: n % 3 === 0 ? "oqc" : n % 3 === 1 ? "anode" : "cathode",
        tray: `T-${shiftIndex + 1}`,
        slot: (n % 12) + 1,
        partOk: !nio,
        source: "seed",
        measurements: {
          phiDeg: round(rng() * 4 - 2, 3),
          widthMm: round(11.4 + rng() * 0.3, 3),
          heightMm: round(5.3 + rng() * 0.2, 3),
          spanMm: round(nio ? 0.18 + rng() * 0.08 : 0.04 + rng() * 0.04, 3),
        },
        findings: nio ? [{ defectClass: defect, score: round(0.7 + rng() * 0.25, 3) }] : [],
      });
      inspections.push(inspection);
      lineEvents.push(
        lineEventIngestSchema.parse({
          dmc,
          observedAt: `${day}T${offsetTime(start, n * 90 + 2)}+02:00`,
          verdict: nio ? "nio" : "io",
          source: "seed",
        }),
      );
    }
  }

  return { inspections, lineEvents };
}

function offsetTime(start: `${string}:${string}:${string}`, seconds: number): string {
  const [h, m, s] = start.split(":").map(Number);
  const total = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) + seconds;
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDay(day: string): number {
  let h = 2166136261;
  for (const ch of day) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
