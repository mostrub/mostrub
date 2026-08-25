import {
  asCaseId,
  asDispositionId,
  asSnapshotId,
  ledgerError,
  type CaseId,
  type CaseStatus,
  type DispositionDecision,
  type DispositionInput,
  type Dmc,
  type OpenCaseInput,
  type PinCaseInput,
  type SnapshotId,
} from "@ledger/types";
import { newAuditId, newCaseId, newDispositionId, newPinId } from "./ids.ts";
import type { ControlStore } from "./postgres.ts";

export type CaseRecord = {
  id: CaseId;
  dmc: Dmc;
  status: CaseStatus;
  title: string;
  openedAt: Date;
  openedBy: string;
  closedAt: Date | null;
  snapshotId: SnapshotId | null;
  dispositions: DispositionRecord[];
  pins: PinRecord[];
};

export type DispositionRecord = {
  id: string;
  decision: DispositionDecision;
  note: string;
  decidedAt: Date;
  decidedBy: string;
};

export type PinRecord = {
  id: string;
  snapshotId: SnapshotId;
  label: string;
  pinnedAt: Date;
  pinnedBy: string;
};

type CaseRow = {
  id: string;
  dmc: string;
  status: CaseStatus;
  title: string;
  opened_at: Date;
  opened_by: string;
  closed_at: Date | null;
  snapshot_id: string | number | null;
};

export async function openCase(
  control: ControlStore,
  input: OpenCaseInput,
): Promise<CaseRecord> {
  const id = newCaseId();
  const openedAt = new Date();
  await control.query(
    `INSERT INTO control.cases (id, dmc, status, title, opened_at, opened_by)
     VALUES ($1, $2, 'open', $3, $4, $5)`,
    [id, input.dmc, input.title, openedAt, input.openedBy],
  );
  await control.writeAudit({
    id: newAuditId(),
    at: openedAt,
    actor: input.openedBy,
    action: "case.open",
    payload: { caseId: id, dmc: input.dmc, title: input.title },
  });
  return loadCase(control, id);
}

export async function pinCase(
  control: ControlStore,
  caseId: CaseId,
  snapshotId: SnapshotId,
  input: PinCaseInput,
): Promise<CaseRecord> {
  const existing = await loadCase(control, caseId);
  const pinnedAt = new Date();
  await control.query(
    `INSERT INTO control.snapshot_pins (id, snapshot_id, case_id, label, pinned_at, pinned_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [newPinId(), snapshotId, caseId, input.label, pinnedAt, input.pinnedBy],
  );
  const nextStatus: CaseStatus = existing.status === "closed" ? "closed" : "pinned";
  await control.query(
    `UPDATE control.cases SET snapshot_id = $1, status = $2 WHERE id = $3`,
    [snapshotId, nextStatus, caseId],
  );
  await control.writeAudit({
    id: newAuditId(),
    at: pinnedAt,
    actor: input.pinnedBy,
    action: "case.pin",
    payload: { caseId, snapshotId, label: input.label },
  });
  return loadCase(control, caseId);
}

export async function addDisposition(
  control: ControlStore,
  caseId: CaseId,
  input: DispositionInput,
): Promise<CaseRecord> {
  await loadCase(control, caseId);
  const decidedAt = new Date();
  const dispositionId = newDispositionId();
  await control.query(
    `INSERT INTO control.dispositions (id, case_id, decision, note, decided_at, decided_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [dispositionId, caseId, input.decision, input.note, decidedAt, input.decidedBy],
  );
  const closes = input.decision === "scrap" || input.decision === "release";
  if (closes) {
    await control.query(
      `UPDATE control.cases SET status = 'closed', closed_at = $1 WHERE id = $2`,
      [decidedAt, caseId],
    );
  }
  await control.writeAudit({
    id: newAuditId(),
    at: decidedAt,
    actor: input.decidedBy,
    action: "case.disposition",
    payload: { caseId, decision: input.decision, dispositionId },
  });
  return loadCase(control, caseId);
}

export async function listCases(
  control: ControlStore,
  status?: CaseStatus,
): Promise<CaseRecord[]> {
  const rows = status
    ? await control.query<CaseRow>(
        `SELECT * FROM control.cases WHERE status = $1 ORDER BY opened_at DESC`,
        [status],
      )
    : await control.query<CaseRow>(
        `SELECT * FROM control.cases ORDER BY opened_at DESC`,
      );
  const records: CaseRecord[] = [];
  for (const row of rows) {
    records.push(await hydrateCase(control, row));
  }
  return records;
}

export async function listOpenCasesForDmc(
  control: ControlStore,
  dmc: Dmc,
): Promise<CaseRecord[]> {
  const rows = await control.query<CaseRow>(
    `SELECT * FROM control.cases WHERE dmc = $1 AND status <> 'closed' ORDER BY opened_at DESC`,
    [dmc],
  );
  const records: CaseRecord[] = [];
  for (const row of rows) {
    records.push(await hydrateCase(control, row));
  }
  return records;
}

export async function loadCase(control: ControlStore, caseId: CaseId): Promise<CaseRecord> {
  const rows = await control.query<CaseRow>(
    `SELECT * FROM control.cases WHERE id = $1`,
    [caseId],
  );
  const row = rows[0];
  if (!row) {
    throw ledgerError("CASE_NOT_FOUND", `Akte ${caseId} nicht gefunden`, 404);
  }
  return hydrateCase(control, row);
}

async function hydrateCase(control: ControlStore, row: CaseRow): Promise<CaseRecord> {
  const dispositions = await control.query<{
    id: string;
    decision: DispositionDecision;
    note: string;
    decided_at: Date;
    decided_by: string;
  }>(
    `SELECT id, decision, note, decided_at, decided_by
     FROM control.dispositions WHERE case_id = $1 ORDER BY decided_at`,
    [row.id],
  );
  const pins = await control.query<{
    id: string;
    snapshot_id: string | number;
    label: string;
    pinned_at: Date;
    pinned_by: string;
  }>(
    `SELECT id, snapshot_id, label, pinned_at, pinned_by
     FROM control.snapshot_pins WHERE case_id = $1 ORDER BY pinned_at`,
    [row.id],
  );
  return {
    id: asCaseId(row.id),
    dmc: row.dmc as CaseRecord["dmc"],
    status: row.status,
    title: row.title,
    openedAt: row.opened_at,
    openedBy: row.opened_by,
    closedAt: row.closed_at,
    snapshotId: row.snapshot_id === null ? null : asSnapshotId(Number(row.snapshot_id)),
    dispositions: dispositions.map((item) => ({
      id: asDispositionId(item.id),
      decision: item.decision,
      note: item.note,
      decidedAt: item.decided_at,
      decidedBy: item.decided_by,
    })),
    pins: pins.map((item) => ({
      id: item.id,
      snapshotId: asSnapshotId(Number(item.snapshot_id)),
      label: item.label,
      pinnedAt: item.pinned_at,
      pinnedBy: item.pinned_by,
    })),
  };
}
