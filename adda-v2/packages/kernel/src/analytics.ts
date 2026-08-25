import { asSnapshotId, type SnapshotId } from "@ledger/types";
import { asSafeInt, sqlLiteral } from "./duck.ts";
import type { Lake } from "./lake.ts";

export type ShiftReport = {
  from: string;
  to: string;
  inspected: number;
  io: number;
  nio: number;
  yield: number | null;
  defects: { defectClass: string; count: number }[];
  _provenance: {
    store: "ducklake";
    query: "shift_report";
    snapshotId: SnapshotId;
  };
};

export async function shiftReport(
  lake: Lake,
  window: { from: string; to: string },
): Promise<ShiftReport> {
  const snapshotId = await lake.currentSnapshot();
  const from = sqlLiteral(window.from);
  const to = sqlLiteral(window.to);
  const totals = await lake.query<{ inspected: number; io: number; nio: number }>(
    `SELECT
       COUNT(*)::INTEGER AS inspected,
       COUNT(*) FILTER (WHERE part_ok)::INTEGER AS io,
       COUNT(*) FILTER (WHERE NOT part_ok)::INTEGER AS nio
     FROM lake.inspections
     WHERE captured_at >= TIMESTAMPTZ '${from}'
       AND captured_at < TIMESTAMPTZ '${to}'`,
  );
  const defects = await lake.query<{ defect_class: string; count: number }>(
    `SELECT f.defect_class, COUNT(*)::INTEGER AS count
     FROM lake.findings f
     JOIN lake.inspections i ON i.inspection_id = f.inspection_id
     WHERE i.captured_at >= TIMESTAMPTZ '${from}'
       AND i.captured_at < TIMESTAMPTZ '${to}'
     GROUP BY f.defect_class
     ORDER BY count DESC, f.defect_class`,
  );
  const row = totals[0] ?? { inspected: 0, io: 0, nio: 0 };
  const inspected = Number(row.inspected);
  const io = Number(row.io);
  const nio = Number(row.nio);
  return {
    from: window.from,
    to: window.to,
    inspected,
    io,
    nio,
    yield: inspected === 0 ? null : io / inspected,
    defects: defects.map((item) => ({
      defectClass: item.defect_class,
      count: Number(item.count),
    })),
    _provenance: {
      store: "ducklake",
      query: "shift_report",
      snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    },
  };
}

export type ChronikEvent = {
  at: Date;
  kind: "inspection" | "line";
  dmc: string;
  summary: string;
  source: string;
};

export async function loadChronik(
  lake: Lake,
  filter: { dmc?: string; from?: string; to?: string; limit?: number },
): Promise<{ events: ChronikEvent[]; snapshotId: SnapshotId }> {
  const snapshotId = await lake.currentSnapshot();
  const limit = filter.limit ?? 200;
  const dmcClause = filter.dmc ? `AND dmc = '${sqlLiteral(filter.dmc)}'` : "";
  const fromClause = filter.from
    ? `AND at >= TIMESTAMPTZ '${sqlLiteral(filter.from)}'`
    : "";
  const toClause = filter.to ? `AND at < TIMESTAMPTZ '${sqlLiteral(filter.to)}'` : "";

  const rows = await lake.query<{
    at: Date;
    kind: "inspection" | "line";
    dmc: string;
    summary: string;
    source: string;
  }>(
    `SELECT * FROM (
       SELECT captured_at AS at, 'inspection' AS kind, dmc,
              CASE WHEN part_ok THEN 'IO' ELSE 'NIO' END AS summary, source
       FROM lake.inspections
       UNION ALL
       SELECT observed_at AS at, 'line' AS kind, dmc, upper(verdict) AS summary, source
       FROM lake.line_events
     ) events
     WHERE 1=1 ${dmcClause} ${fromClause} ${toClause}
     ORDER BY at DESC
     LIMIT ${limit}`,
  );

  return {
    snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    events: rows.map((row) => ({
      at: row.at,
      kind: row.kind,
      dmc: row.dmc,
      summary: row.summary,
      source: row.source,
    })),
  };
}
