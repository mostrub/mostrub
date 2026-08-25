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
    ? `AND occurred_at >= TIMESTAMPTZ '${sqlLiteral(filter.from)}'`
    : "";
  const toClause = filter.to
    ? `AND occurred_at < TIMESTAMPTZ '${sqlLiteral(filter.to)}'`
    : "";

  const rows = await lake.query<{
    occurred_at: Date;
    kind: "inspection" | "line";
    dmc: string;
    summary: string;
    source: string;
  }>(
    `SELECT occurred_at, kind, dmc, summary, source FROM (
       SELECT captured_at AS occurred_at, 'inspection' AS kind, dmc,
              CASE WHEN part_ok THEN 'IO' ELSE 'NIO' END AS summary, source
       FROM lake.inspections
       UNION ALL
       SELECT observed_at AS occurred_at, 'line' AS kind, dmc, upper(verdict) AS summary, source
       FROM lake.line_events
     ) events
     WHERE 1=1 ${dmcClause} ${fromClause} ${toClause}
     ORDER BY occurred_at DESC
     LIMIT ${limit}`,
  );

  return {
    snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    events: rows.map((row) => ({
      at: row.occurred_at,
      kind: row.kind,
      dmc: row.dmc,
      summary: row.summary,
      source: row.source,
    })),
  };
}

export type LineCell = {
  dmc: string;
  capturedAt: Date;
  station: "anode" | "cathode" | "oqc";
  partOk: boolean;
  spanMm: number | null;
  defectClass: string | null;
};

export type LineHour = {
  hour: number;
  inspected: number;
  nio: number;
};

export type LineBoard = {
  snapshotId: SnapshotId;
  inspected: number;
  nio: number;
  yield: number | null;
  taktPerHour: number | null;
  spanMean: number | null;
  hours: LineHour[];
  defects: { defectClass: string; count: number }[];
  stations: {
    station: "anode" | "cathode" | "oqc";
    inspected: number;
    nio: number;
    nioRate: number | null;
    last: LineCell[];
  }[];
  _provenance: {
    store: "ducklake";
    query: "line_board";
    snapshotId: SnapshotId;
  };
};

const STATIONS = ["anode", "cathode", "oqc"] as const;

export async function latestShiftWindow(lake: Lake): Promise<{ from: string; to: string }> {
  const rows = await lake.query<{ day: string | null }>(
    `SELECT strftime(MAX(captured_at), '%Y-%m-%d') AS day FROM lake.inspections`,
  );
  return zurichCivilDay(rows[0]?.day ?? zurichToday());
}

export async function lineBoard(lake: Lake): Promise<LineBoard> {
  const snapshotId = await lake.currentSnapshot();
  const totals = await lake.query<{
    inspected: number;
    nio: number;
    hours: number;
  }>(
    `SELECT
       COUNT(*)::INTEGER AS inspected,
       COUNT(*) FILTER (WHERE NOT part_ok)::INTEGER AS nio,
       GREATEST(1, date_diff('hour', MIN(captured_at), MAX(captured_at)))::DOUBLE AS hours
     FROM lake.inspections`,
  );
  const span = await lake.query<{ span_mean: number | null }>(
    `SELECT AVG(span_mm) AS span_mean FROM lake.measurements`,
  );
  const stationRates = await lake.query<{
    station: string;
    inspected: number;
    nio: number;
  }>(
    `SELECT station, COUNT(*)::INTEGER AS inspected,
            COUNT(*) FILTER (WHERE NOT part_ok)::INTEGER AS nio
     FROM lake.inspections
     GROUP BY station`,
  );
  const hours = await lake.query<{ hour: number; inspected: number; nio: number }>(
    `SELECT CAST(date_part('hour', captured_at) AS INTEGER) AS hour,
            COUNT(*)::INTEGER AS inspected,
            COUNT(*) FILTER (WHERE NOT part_ok)::INTEGER AS nio
     FROM lake.inspections
     GROUP BY 1
     ORDER BY 1`,
  );
  const defects = await lake.query<{ defect_class: string; count: number }>(
    `SELECT defect_class, COUNT(*)::INTEGER AS count
     FROM lake.findings
     GROUP BY defect_class
     ORDER BY count DESC, defect_class`,
  );
  const recent = await lake.query<{
    dmc: string;
    captured_at: Date;
    station: string;
    part_ok: boolean;
    span_mm: number | null;
    defect_class: string | null;
    rn: number;
  }>(
    `SELECT dmc, captured_at, station, part_ok, span_mm, defect_class, rn FROM (
       SELECT i.dmc, i.captured_at, i.station, i.part_ok, m.span_mm,
              (SELECT f.defect_class FROM lake.findings f
               WHERE f.inspection_id = i.inspection_id
               ORDER BY f.score DESC LIMIT 1) AS defect_class,
              row_number() OVER (PARTITION BY i.station ORDER BY i.captured_at DESC) AS rn
       FROM lake.inspections i
       LEFT JOIN lake.measurements m ON m.inspection_id = i.inspection_id
     ) ranked
     WHERE rn <= 8
     ORDER BY station, captured_at DESC`,
  );
  const total = totals[0] ?? { inspected: 0, nio: 0, hours: 1 };
  const inspected = Number(total.inspected);
  const nio = Number(total.nio);
  const spanHours = Number(total.hours) || 1;
  const spanMean = span[0]?.span_mean ?? null;
  return {
    snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    inspected,
    nio,
    yield: inspected === 0 ? null : (inspected - nio) / inspected,
    taktPerHour: inspected === 0 ? null : inspected / spanHours,
    spanMean: spanMean === null ? null : Number(spanMean),
    hours: hours.map((row) => ({
      hour: Number(row.hour),
      inspected: Number(row.inspected),
      nio: Number(row.nio),
    })),
    defects: defects.map((item) => ({
      defectClass: item.defect_class,
      count: Number(item.count),
    })),
    stations: STATIONS.map((station) => {
      const rate = stationRates.find((row) => row.station === station);
      const count = Number(rate?.inspected ?? 0);
      const stationNio = Number(rate?.nio ?? 0);
      return {
        station,
        inspected: count,
        nio: stationNio,
        nioRate: count === 0 ? null : stationNio / count,
        last: recent
          .filter((row) => row.station === station)
          .map((row) => ({
            dmc: row.dmc,
            capturedAt: row.captured_at,
            station,
            partOk: row.part_ok,
            spanMm: row.span_mm === null ? null : Number(row.span_mm),
            defectClass: row.defect_class,
          })),
      };
    }),
    _provenance: {
      store: "ducklake",
      query: "line_board",
      snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    },
  };
}

function zurichToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function zurichCivilDay(day: string): { from: string; to: string } {
  const offset = zurichOffsetIso(day);
  const next = nextCivilDay(day);
  return { from: `${day}T00:00:00${offset}`, to: `${next}T00:00:00${zurichOffsetIso(next)}` };
}

function nextCivilDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const utc = Date.UTC(year ?? 1970, (month ?? 1) - 1, (date ?? 1) + 1);
  return new Date(utc).toISOString().slice(0, 10);
}

function zurichOffsetIso(day: string): string {
  const probe = new Date(`${day}T12:00:00Z`);
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Zurich",
      timeZoneName: "shortOffset",
    })
      .formatToParts(probe)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+2";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return "+02:00";
  const hour = (match[2] ?? "2").padStart(2, "0");
  const minute = (match[3] ?? "00").padStart(2, "0");
  return `${match[1]}${hour}:${minute}`;
}
