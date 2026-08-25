export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error ?? "UNKNOWN",
      body.message ?? `Anfrage fehlgeschlagen (${response.status})`,
    );
  }
  return body as T;
}

export type CaseRecord = {
  id: string;
  dmc: string;
  status: "open" | "pinned" | "closed";
  title: string;
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  snapshotId: number | null;
  dispositions: {
    id: string;
    decision: string;
    note: string;
    decidedAt: string;
    decidedBy: string;
  }[];
  pins: {
    id: string;
    snapshotId: number;
    label: string;
    pinnedAt: string;
    pinnedBy: string;
  }[];
};

export type Dossier = {
  dmc: string;
  snapshotId: number;
  inspections: {
    inspectionId: string;
    capturedAt: string;
    station: string;
    tray: string;
    slot: number;
    partOk: boolean;
    source: string;
    findings: { defectClass: string; score: number }[];
  }[];
  lineEvents: {
    eventId: string;
    observedAt: string;
    verdict: string;
    source: string;
  }[];
  openCases?: CaseRecord[];
};

export type LakeStatus = {
  currentSnapshotId: number;
  metadataSchema: string;
  lakePath: string;
  snapshots: {
    snapshotId: number;
    snapshotTime: string;
    author: string | null;
    commitMessage: string | null;
  }[];
};

export type ShiftReport = {
  from: string;
  to: string;
  inspected: number;
  io: number;
  nio: number;
  yield: number | null;
  defects: { defectClass: string; count: number }[];
  _provenance: { store: string; query: string; snapshotId: number };
};

export type Chronik = {
  snapshotId: number;
  events: {
    at: string;
    kind: "inspection" | "line";
    dmc: string;
    summary: string;
    source: string;
  }[];
};

export const api = {
  health: () => request<{ ok: boolean; snapshotId: number }>("/health"),
  cases: (status?: string) =>
    request<{ cases: CaseRecord[] }>(status ? `/api/cases?status=${status}` : "/api/cases"),
  case: (id: string) => request<CaseRecord>(`/api/cases/${id}`),
  openCase: (input: { dmc: string; title: string; openedBy: string }) =>
    request<CaseRecord>("/api/cases", { method: "POST", body: JSON.stringify(input) }),
  pinCase: (id: string, input: { label: string; pinnedBy: string }) =>
    request<CaseRecord>(`/api/cases/${id}/pin`, { method: "POST", body: JSON.stringify(input) }),
  dispose: (id: string, input: { decision: string; note: string; decidedBy: string }) =>
    request<CaseRecord>(`/api/cases/${id}/dispositions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cell: (dmc: string) => request<Dossier>(`/api/cells/${encodeURIComponent(dmc)}`),
  cellAt: (snapshotId: number, dmc: string) =>
    request<Dossier>(`/api/see/at/${snapshotId}/cells/${encodeURIComponent(dmc)}`),
  chronik: () => request<Chronik>("/api/chronik?limit=120"),
  schicht: (from: string, to: string) =>
    request<ShiftReport>(`/api/schicht?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  lake: () => request<LakeStatus>("/api/lake/status"),
};
