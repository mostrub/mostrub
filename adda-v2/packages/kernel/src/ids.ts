import { ulid } from "ulidx";
import {
  asCaseId,
  asDispositionId,
  asEventId,
  asInspectionId,
  type CaseId,
  type DispositionId,
  type EventId,
  type InspectionId,
} from "@ledger/types";

export function newInspectionId(): InspectionId {
  return asInspectionId(ulid());
}

export function newEventId(): EventId {
  return asEventId(ulid());
}

export function newCaseId(): CaseId {
  return asCaseId(ulid());
}

export function newDispositionId(): DispositionId {
  return asDispositionId(ulid());
}

export function newAuditId(): string {
  return ulid();
}

export function newPinId(): string {
  return ulid();
}
