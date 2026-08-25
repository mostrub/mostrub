import type {
  CaseId,
  CaseStatus,
  DispositionInput,
  Dmc,
  InspectionIngest,
  LineEventIngest,
  OpenCaseInput,
  PinCaseInput,
  SnapshotId,
} from "@ledger/types";
import { latestShiftWindow, lineBoard, loadChronik, shiftReport } from "./analytics.ts";
import {
  addDisposition,
  listCases,
  listOpenCasesForDmc,
  loadCase,
  openCase,
  pinCase,
} from "./cases.ts";
import type { LedgerConfig } from "./config.ts";
import { loadDossier, loadDossierAt } from "./dossier.ts";
import { ingestInspections, ingestLineEvents } from "./ingest.ts";
import { Lake } from "./lake.ts";
import { ControlStore, createPool, migrateControl } from "./postgres.ts";
import { seedLedger } from "./seed.ts";
import type { Pool } from "pg";

export class Ledger {
  private constructor(
    readonly config: LedgerConfig,
    readonly lake: Lake,
    readonly control: ControlStore,
    private readonly pool: Pool,
  ) {}

  static async open(config: LedgerConfig): Promise<Ledger> {
    const pool = createPool(config.pgUrl);
    await migrateControl(pool);
    const lake = await Lake.open(config);
    return new Ledger(config, lake, new ControlStore(pool), pool);
  }

  async close(): Promise<void> {
    await this.lake.close();
    await this.pool.end();
  }

  ingestInspections(rows: InspectionIngest[], actor = "ingest") {
    return ingestInspections(this.lake, rows, actor);
  }

  ingestLineEvents(rows: LineEventIngest[], actor = "ingest") {
    return ingestLineEvents(this.lake, rows, actor);
  }

  loadDossier(dmc: Dmc) {
    return loadDossier(this.lake, dmc);
  }

  loadDossierAt(dmc: Dmc, snapshotId: SnapshotId) {
    return loadDossierAt(this.lake, dmc, snapshotId);
  }

  openCase(input: OpenCaseInput) {
    return openCase(this.control, input);
  }

  pinCase(caseId: CaseId, snapshotId: SnapshotId, input: PinCaseInput) {
    return pinCase(this.control, caseId, snapshotId, input);
  }

  addDisposition(caseId: CaseId, input: DispositionInput) {
    return addDisposition(this.control, caseId, input);
  }

  listCases(status?: CaseStatus) {
    return listCases(this.control, status);
  }

  listOpenCasesForDmc(dmc: Dmc) {
    return listOpenCasesForDmc(this.control, dmc);
  }

  loadCase(caseId: CaseId) {
    return loadCase(this.control, caseId);
  }

  shiftReport(window: { from: string; to: string }) {
    return shiftReport(this.lake, window);
  }

  chronik(filter: { dmc?: string; from?: string; to?: string; limit?: number }) {
    return loadChronik(this.lake, filter);
  }

  lineBoard() {
    return lineBoard(this.lake);
  }

  latestShiftWindow() {
    return latestShiftWindow(this.lake);
  }

  lakeStatus() {
    return this.lake.listSnapshots().then(async (snapshots) => ({
      currentSnapshotId: await this.lake.currentSnapshot(),
      snapshots,
      metadataSchema: this.config.metadataSchema,
      lakePath: this.config.lakePath,
    }));
  }

  seed(day: string) {
    return seedLedger(this.lake, this.control, { day });
  }
}
