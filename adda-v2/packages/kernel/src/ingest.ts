import type {
  InspectionIngest,
  LineEventIngest,
  SnapshotId,
} from "@ledger/types";
import { newEventId, newInspectionId } from "./ids.ts";
import type { Lake } from "./lake.ts";
import { sqlLiteral } from "./duck.ts";

export async function ingestInspections(
  lake: Lake,
  rows: InspectionIngest[],
  actor: string,
): Promise<{ snapshotId: SnapshotId; inspectionIds: string[] }> {
  const inspectionIds: string[] = [];
  const snapshotId = await lake.withCommit({
    author: actor,
    message: `ingest ${rows.length} inspections`,
    extra: JSON.stringify({ count: rows.length, source: rows[0]?.source ?? "valtr" }),
    work: async () => {
      for (const row of rows) {
        const id = newInspectionId();
        inspectionIds.push(id);
        await lake.exec(
          `INSERT INTO lake.inspections
           VALUES ('${id}', '${sqlLiteral(row.dmc)}', TIMESTAMPTZ '${sqlLiteral(row.capturedAt)}',
                   '${sqlLiteral(row.station)}', '${sqlLiteral(row.tray)}', ${row.slot},
                   ${row.partOk}, '${sqlLiteral(row.source)}')`,
        );
        await lake.exec(
          `INSERT INTO lake.measurements
           VALUES ('${id}', ${row.measurements.phiDeg}, ${row.measurements.widthMm},
                   ${row.measurements.heightMm}, ${row.measurements.spanMm})`,
        );
        for (const finding of row.findings) {
          await lake.exec(
            `INSERT INTO lake.findings
             VALUES ('${id}', '${sqlLiteral(finding.defectClass)}', ${finding.score})`,
          );
        }
      }
    },
  });
  return { snapshotId, inspectionIds };
}

export async function ingestLineEvents(
  lake: Lake,
  rows: LineEventIngest[],
  actor: string,
): Promise<{ snapshotId: SnapshotId; eventIds: string[] }> {
  const eventIds: string[] = [];
  const snapshotId = await lake.withCommit({
    author: actor,
    message: `ingest ${rows.length} line events`,
    extra: JSON.stringify({ count: rows.length, source: rows[0]?.source ?? "mqtt" }),
    work: async () => {
      for (const row of rows) {
        const id = newEventId();
        eventIds.push(id);
        await lake.exec(
          `INSERT INTO lake.line_events
           VALUES ('${id}', '${sqlLiteral(row.dmc)}', TIMESTAMPTZ '${sqlLiteral(row.observedAt)}',
                   '${sqlLiteral(row.verdict)}', '${sqlLiteral(row.source)}')`,
        );
      }
    },
  });
  return { snapshotId, eventIds };
}
