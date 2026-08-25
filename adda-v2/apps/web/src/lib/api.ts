export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function operatorAuth(): Record<string, string> {
  const token = import.meta.env.VITE_LEDGER_OPERATOR_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...operatorAuth(),
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
    measurements: { spanMm: number } | null;
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
  day: string;
  inspected: number;
  io: number;
  nio: number;
  yield: number | null;
  defects: { defectClass: string; count: number }[];
  hours: { hour: number; inspected: number; nio: number }[];
  stations: {
    station: "anode" | "cathode" | "oqc";
    inspected: number;
    nio: number;
    nioRate: number | null;
  }[];
  spanWindow: {
    min: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
    mean: number | null;
  };
  nioCells: LineCell[];
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

export type LineCell = {
  dmc: string;
  capturedAt: string;
  station: "anode" | "cathode" | "oqc";
  tray: string;
  slot: number;
  partOk: boolean;
  spanMm: number | null;
  defectClass: string | null;
  source: string;
};

export type LineBoard = {
  snapshotId: number;
  inspected: number;
  nio: number;
  yield: number | null;
  taktPerHour: number | null;
  spanMean: number | null;
  spanWindow: {
    min: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
    mean: number | null;
  };
  hours: { hour: number; inspected: number; nio: number }[];
  defects: { defectClass: string; count: number }[];
  trays: { tray: string; slots: { slot: number; cells: LineCell[] }[] }[];
  cells: LineCell[];
  timeline: {
    from: string;
    to: string;
    events: { at: string; dmc: string; nio: boolean; station: LineCell["station"] }[];
  };
  stations: {
    station: "anode" | "cathode" | "oqc";
    inspected: number;
    nio: number;
    nioRate: number | null;
    last: LineCell[];
  }[];
  _provenance: { store: string; query: string; snapshotId: number };
};

export const api = {
  health: () => request<{ ok: boolean; snapshotId: number }>("/health"),
  linie: () => request<LineBoard>("/api/linie"),
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
  schicht: (tag?: string) =>
    request<ShiftReport>(tag ? `/api/schicht?tag=${encodeURIComponent(tag)}` : "/api/schicht"),
  schichtTage: () => request<{ days: string[] }>("/api/schicht/tage"),
  lake: () => request<LakeStatus>("/api/lake/status"),
};
