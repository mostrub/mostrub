export {
  asCaseId,
  asDispositionId,
  asEventId,
  asInspectionId,
  asSnapshotId,
  KEIN_DMC,
  parseDmc,
  type Brand,
  type CaseId,
  type DispositionId,
  type Dmc,
  type EventId,
  type InspectionId,
  type SnapshotId,
} from "./brands.ts";
export { DEFECT_CLASSES, isDefectClass, type DefectClass } from "./defects.ts";
export {
  caseStatusSchema,
  defectClassSchema,
  dispositionDecisionSchema,
  dispositionSchema,
  findingSchema,
  inspectionIngestSchema,
  lineEventIngestSchema,
  measurementSchema,
  openCaseSchema,
  pinCaseSchema,
  stationSchema,
  verdictSchema,
  type CaseStatus,
  type DispositionDecision,
  type DispositionInput,
  type InspectionIngest,
  type LineEventIngest,
  type OpenCaseInput,
  type PinCaseInput,
  type Station,
  type Verdict,
} from "./schemas.ts";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  readonly status: number;

  constructor(code: LedgerErrorCode, message: string, status: number) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.status = status;
  }
}

export type LedgerErrorCode =
  | "LAKEHOUSE_READ_UNAVAILABLE"
  | "CELL_NOT_FOUND"
  | "CASE_NOT_FOUND"
  | "SNAPSHOT_CONFLICT"
  | "INGEST_FORBIDDEN"
  | "INVALID_DATABASE"
  | "VALIDATION_FAILED";

export function ledgerError(
  code: LedgerErrorCode,
  message: string,
  status: number,
): LedgerError {
  return new LedgerError(code, message, status);
}
