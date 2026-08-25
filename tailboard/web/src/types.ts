export type Signal = "clear" | "advisory" | "alarm";
export type Severity = "critical" | "warning" | "info";
export type Role = "self" | "exit" | "subnet" | "jail" | "shared" | "workstation";
export type NodeState = "online" | "idle" | "offline" | "unauthorized" | "expired" | "unknown";

export type Node = {
  id: string;
  nodeId: string;
  hostname: string;
  name: string;
  os: string;
  user: string;
  clientVersion: string;
  addresses: string[];
  tags: string[];
  authorized: boolean;
  online: boolean;
  active: boolean;
  updateAvailable: boolean;
  keyExpiryDisabled: boolean;
  isExternal: boolean;
  isEphemeral: boolean;
  blocksIncoming: boolean;
  jail: boolean;
  exit: boolean;
  exitOption: boolean;
  subnet: boolean;
  expired: boolean;
  role: Role;
  state: NodeState;
  relay: string;
  curAddr: string;
  latencyMs: number | null;
  rxBytes: number;
  txBytes: number;
  advertisedRoutes: string[];
  enabledRoutes: string[];
  endpoints: string[];
  derp: string;
  lastSeen: string | null;
  lastHandshake: string | null;
  created: string | null;
  expires: string | null;
  self: boolean;
};

export type Alert = {
  id: string;
  kind: string;
  severity: Severity;
  nodeId?: string;
  fingerprint: string;
  title: string;
  detail: string;
  openedAt: string;
  ackedAt?: string | null;
  resolvedAt?: string | null;
};

export type Memo = {
  id: string;
  author: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type Briefing = {
  id: string;
  source: string;
  body: string;
  createdAt: string;
};

export type Event = {
  ts: string;
  kind: string;
  nodeId?: string;
  title: string;
  detail: string;
};

export type KPI = {
  online: number;
  total: number;
  jails: number;
  jailsDown: number;
  exits: number;
  exitsDown: number;
  routers: number;
  routersDown: number;
  latencyP95: number | null;
  keysSoon: number;
  health: number;
};

export type Snapshot = {
  collectedAt: string;
  source: string;
  tailnet: string;
  magicDns: string;
  magicDnsEnabled: boolean;
  backendState: string;
  health: string[];
  nameservers: string[];
  selfId: string;
  nodes: Node[];
  readerError?: string;
};

export type Board = {
  signal: Signal;
  snapshot: Snapshot;
  kpi: KPI;
  alerts: Alert[];
  memos: Memo[];
  briefing?: Briefing | null;
  events: Event[];
};

export type Sample = {
  ts: string;
  nodeId: string;
  online: boolean;
  latencyMs?: number | null;
  rxBytes: number;
  txBytes: number;
  relay: string;
  state: NodeState;
};

export type NodeDetail = {
  node: Node;
  history: Sample[];
};

export type Filter = "all" | "jails" | "exits" | "routers" | "offline" | "shared";
