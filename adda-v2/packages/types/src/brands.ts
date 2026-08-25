export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Dmc = Brand<string, "Dmc">;
export type CaseId = Brand<string, "CaseId">;
export type SnapshotId = Brand<number, "SnapshotId">;
export type InspectionId = Brand<string, "InspectionId">;
export type DispositionId = Brand<string, "DispositionId">;
export type EventId = Brand<string, "EventId">;

export const KEIN_DMC = "KEIN_DMC" as Dmc;

export function parseDmc(raw: string): Dmc {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return KEIN_DMC;
  }
  return trimmed as Dmc;
}

export function asCaseId(raw: string): CaseId {
  return raw as CaseId;
}

export function asSnapshotId(raw: number): SnapshotId {
  return raw as SnapshotId;
}

export function asInspectionId(raw: string): InspectionId {
  return raw as InspectionId;
}

export function asDispositionId(raw: string): DispositionId {
  return raw as DispositionId;
}

export function asEventId(raw: string): EventId {
  return raw as EventId;
}
