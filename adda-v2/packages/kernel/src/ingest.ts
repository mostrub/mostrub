import { ledgerError, type InspectionIngest, type LineEventIngest, type SnapshotId } from "@ledger/types";
import { newEventId, newInspectionId } from "./ids.ts";
import type { Lake } from "./lake.ts";
import { sqlLiteral } from "./duck.ts";

export async function ingestInspections(
  lake: Lake,
  rows: InspectionIngest[],
  actor: string,
): Promise<{ snapshotId: SnapshotId; inspectionIds: string[] }> {
  if (rows.length === 0) {
    throw ledgerError("VALIDATION_FAILED", "keine Inspektionen", 422);
  }
  const prepared = rows.map((row) => ({
    id: newInspectionId(),
    row,
  }));
  const snapshotId = await lake.withCommit({
    author: actor,
    message: `ingest ${prepared.length} inspections`,
    extra: JSON.stringify({ count: prepared.length, source: rows[0]?.source ?? "valtr" }),
    work: async () => {
      await lake.exec(
        `INSERT INTO lake.inspections
          (inspection_id, dmc, captured_at, station, tray, slot, part_ok, source)
         VALUES ${prepared
           .map(
             ({ id, row }) =>
               `('${id}', '${sqlLiteral(row.dmc)}', TIMESTAMPTZ '${sqlLiteral(row.capturedAt)}',
                 '${sqlLiteral(row.station)}', '${sqlLiteral(row.tray)}', ${sqlInt(row.slot)},
                 ${sqlBool(row.partOk)}, '${sqlLiteral(row.source)}')`,
           )
           .join(",\n")}`,
      );
      await lake.exec(
        `INSERT INTO lake.measurements
          (inspection_id, phi_deg, width_mm, height_mm, span_mm)
         VALUES ${prepared
           .map(
             ({ id, row }) =>
               `('${id}', ${sqlNum(row.measurements.phiDeg)}, ${sqlNum(row.measurements.widthMm)},
                 ${sqlNum(row.measurements.heightMm)}, ${sqlNum(row.measurements.spanMm)})`,
           )
           .join(",\n")}`,
      );
      const findings = prepared.flatMap(({ id, row }) =>
        row.findings.map((finding) => ({ id, finding })),
      );
      if (findings.length === 0) return;
      await lake.exec(
        `INSERT INTO lake.findings (inspection_id, defect_class, score)
         VALUES ${findings
           .map(
             ({ id, finding }) =>
               `('${id}', '${sqlLiteral(finding.defectClass)}', ${sqlNum(finding.score)})`,
           )
           .join(",\n")}`,
      );
    },
  });
  return { snapshotId, inspectionIds: prepared.map((item) => item.id) };
}

export async function ingestLineEvents(
  lake: Lake,
  rows: LineEventIngest[],
  actor: string,
): Promise<{ snapshotId: SnapshotId; eventIds: string[] }> {
  if (rows.length === 0) {
    throw ledgerError("VALIDATION_FAILED", "keine Linienereignisse", 422);
  }
  const prepared = rows.map((row) => ({
    id: newEventId(),
    row,
  }));
  const snapshotId = await lake.withCommit({
    author: actor,
    message: `ingest ${prepared.length} line events`,
    extra: JSON.stringify({ count: prepared.length, source: rows[0]?.source ?? "mqtt" }),
    work: async () => {
      await lake.exec(
        `INSERT INTO lake.line_events
          (event_id, dmc, observed_at, verdict, source)
         VALUES ${prepared
           .map(
             ({ id, row }) =>
               `('${id}', '${sqlLiteral(row.dmc)}', TIMESTAMPTZ '${sqlLiteral(row.observedAt)}',
                 '${sqlLiteral(row.verdict)}', '${sqlLiteral(row.source)}')`,
           )
           .join(",\n")}`,
      );
    },
  });
  return { snapshotId, eventIds: prepared.map((item) => item.id) };
}

function sqlBool(value: boolean): string {
  return value ? "TRUE" : "FALSE";
}

function sqlInt(value: number): string {
  if (!Number.isInteger(value)) {
    throw ledgerError("VALIDATION_FAILED", `keine ganze Zahl: ${value}`, 422);
  }
  return String(value);
}

function sqlNum(value: number): string {
  if (!Number.isFinite(value)) {
    throw ledgerError("VALIDATION_FAILED", `keine endliche Zahl: ${value}`, 422);
  }
  return String(value);
}
