import {
  asSnapshotId,
  LedgerError,
  ledgerError,
  type Dmc,
  type SnapshotId,
} from "@ledger/types";
import { attachAtSnapshot, type Lake } from "./lake.ts";
import { asSafeInt, sqlLiteral } from "./duck.ts";

export type DossierInspection = {
  inspectionId: string;
  capturedAt: Date;
  station: string;
  tray: string;
  slot: number;
  partOk: boolean;
  source: string;
  measurements: {
    phiDeg: number;
    widthMm: number;
    heightMm: number;
    spanMm: number;
  } | null;
  findings: { defectClass: string; score: number }[];
};

export type DossierLineEvent = {
  eventId: string;
  observedAt: Date;
  verdict: string;
  source: string;
};

export type CellDossier = {
  dmc: Dmc;
  snapshotId: SnapshotId;
  inspections: DossierInspection[];
  lineEvents: DossierLineEvent[];
  _provenance: {
    store: "ducklake";
    query: "cell_dossier";
    snapshotId: SnapshotId;
  };
};

export async function loadDossier(lake: Lake, dmc: Dmc): Promise<CellDossier> {
  const snapshotId = await lake.currentSnapshot();
  return readDossier(lake, dmc, snapshotId);
}

export async function loadDossierAt(
  lake: Lake,
  dmc: Dmc,
  snapshotId: SnapshotId,
): Promise<CellDossier> {
  const historical = await attachAtSnapshot(lake.config, snapshotId);
  try {
    return await readDossier(historical, dmc, snapshotId);
  } catch (err) {
    if (err instanceof LedgerError && /does not exist/i.test(err.message)) {
      throw ledgerError(
        "SNAPSHOT_CONFLICT",
        `Snapshot ${snapshotId} liegt vor dem Evidenzschema`,
        409,
      );
    }
    throw err;
  } finally {
    await historical.close();
  }
}

async function readDossier(
  lake: Lake,
  dmc: Dmc,
  snapshotId: SnapshotId,
): Promise<CellDossier> {
  const inspections = await lake.query<{
    inspection_id: string;
    captured_at: Date;
    station: string;
    tray: string;
    slot: number;
    part_ok: boolean;
    source: string;
    phi_deg: number | null;
    width_mm: number | null;
    height_mm: number | null;
    span_mm: number | null;
  }>(
    `SELECT i.inspection_id, i.captured_at, i.station, i.tray, i.slot, i.part_ok, i.source,
            m.phi_deg, m.width_mm, m.height_mm, m.span_mm
     FROM lake.inspections i
     LEFT JOIN lake.measurements m ON m.inspection_id = i.inspection_id
     WHERE i.dmc = '${sqlLiteral(dmc)}'
     ORDER BY i.captured_at, i.inspection_id`,
  );

  const findings = await lake.query<{
    inspection_id: string;
    defect_class: string;
    score: number;
  }>(
    `SELECT f.inspection_id, f.defect_class, f.score
     FROM lake.findings f
     JOIN lake.inspections i ON i.inspection_id = f.inspection_id
     WHERE i.dmc = '${sqlLiteral(dmc)}'`,
  );

  const byInspection = new Map<string, { defectClass: string; score: number }[]>();
  for (const row of findings) {
    const list = byInspection.get(row.inspection_id) ?? [];
    list.push({ defectClass: row.defect_class, score: row.score });
    byInspection.set(row.inspection_id, list);
  }

  const lineEvents = await lake.query<{
    event_id: string;
    observed_at: Date;
    verdict: string;
    source: string;
  }>(
    `SELECT event_id, observed_at, verdict, source
     FROM lake.line_events
     WHERE dmc = '${sqlLiteral(dmc)}'
     ORDER BY observed_at, event_id`,
  );

  if (inspections.length === 0 && lineEvents.length === 0) {
    throw ledgerError("CELL_NOT_FOUND", `keine Evidenz für ${dmc}`, 404);
  }

  return {
    dmc,
    snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    inspections: inspections.map((row) => ({
      inspectionId: row.inspection_id,
      capturedAt: row.captured_at,
      station: row.station,
      tray: row.tray,
      slot: row.slot,
      partOk: row.part_ok,
      source: row.source,
      measurements:
        row.phi_deg === null || row.width_mm === null
          ? null
          : {
              phiDeg: row.phi_deg,
              widthMm: row.width_mm,
              heightMm: row.height_mm ?? 0,
              spanMm: row.span_mm ?? 0,
            },
      findings: byInspection.get(row.inspection_id) ?? [],
    })),
    lineEvents: lineEvents.map((row) => ({
      eventId: row.event_id,
      observedAt: row.observed_at,
      verdict: row.verdict,
      source: row.source,
    })),
    _provenance: {
      store: "ducklake",
      query: "cell_dossier",
      snapshotId: asSnapshotId(asSafeInt(snapshotId)),
    },
  };
}
