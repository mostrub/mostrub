import { useEffect, useMemo, useRef, useState } from "react";
import { ackAlert, fetchBoard, fetchNode, pinMemo, postMemo, refreshBrief, subscribeBoard } from "./api";
import { Sparkline } from "./sparkline";
import type { Board, Filter, Node, NodeDetail, Sample, Signal } from "./types";

export function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [locked, setLocked] = useState(false);
  const [kiosk, setKiosk] = useState(true);
  const [clock, setClock] = useState(() => new Date());
  const [memo, setMemo] = useState("");
  const [author, setAuthor] = useState("operator");
  const seenCritical = useRef(new Set<string>());
  const audioOn = useRef(false);

  useEffect(() => {
    void fetchBoard().then(setBoard).catch(() => undefined);
    return subscribeBoard(setBoard);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const nodes = board?.snapshot.nodes ?? [];
  const visible = useMemo(() => nodes.filter((n) => matchFilter(n, filter)), [nodes, filter]);

  useEffect(() => {
    if (selected && visible.some((n) => n.id === selected)) {
      return;
    }
    const first = visible[0];
    if (first) {
      setSelected(first.id);
    }
  }, [selected, visible]);

  useEffect(() => {
    if (!selected || !board) {
      return;
    }
    void fetchNode(selected).then(setDetail).catch(() => setDetail(null));
  }, [selected, board?.snapshot.collectedAt]);

  useEffect(() => {
    if (!kiosk || locked || visible.length === 0) {
      return;
    }
    const t = window.setInterval(() => {
      setSelected((cur) => {
        const idx = visible.findIndex((n) => n.id === cur);
        const next = visible[(idx + 1) % visible.length];
        return next ? next.id : cur;
      });
    }, 20000);
    return () => window.clearInterval(t);
  }, [kiosk, locked, visible]);

  useEffect(() => {
    if (!board) {
      return;
    }
    for (const a of board.alerts) {
      if (a.severity !== "critical" || a.ackedAt || seenCritical.current.has(a.id)) {
        continue;
      }
      seenCritical.current.add(a.id);
      if (audioOn.current) {
        beep();
      }
    }
  }, [board]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
        if (ev.key === "Escape") {
          (ev.target as HTMLElement).blur();
        }
        return;
      }
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
        step(1);
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
        step(-1);
      } else if (ev.key === "l") {
        setLocked((v) => !v);
      } else if (ev.key === "k") {
        setKiosk((v) => !v);
      } else if (ev.key === "a") {
        const first = board?.alerts.find((x) => !x.ackedAt);
        if (first) {
          void ackAlert(first.id);
        }
      } else if (ev.key === "m") {
        document.getElementById("memo-body")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board, visible]);

  function step(dir: number) {
    if (visible.length === 0) {
      return;
    }
    const idx = Math.max(0, visible.findIndex((n) => n.id === selected));
    const next = visible[(idx + dir + visible.length) % visible.length];
    if (next) {
      setSelected(next.id);
      setLocked(true);
    }
  }

  const historyByNode = useMemo(() => {
    const m = new Map<string, Sample[]>();
    if (detail) {
      m.set(detail.node.id, detail.history ?? []);
    }
    return m;
  }, [detail]);

  if (!board) {
    return <div className="board loading">acquiring signal…</div>;
  }

  return (
    <div
      className={`board signal-${board.signal}`}
      onClick={() => {
        audioOn.current = true;
      }}
    >
      <header className="mast">
        <div className="mast-clock">
          <div className="clock">{fmtClock(clock)}</div>
          <div className="clock-sub">{fmtDate(clock)}</div>
        </div>
        <div className="mast-brand">
          <h1>TAILBOARD</h1>
          <p>Tailscale operations signal</p>
        </div>
        <div className="mast-meta">
          <Meta label="tailnet" value={board.snapshot.tailnet || "—"} />
          <Meta label="reader" value={board.snapshot.source} />
          <Meta label="backend" value={board.snapshot.backendState || "n/a"} />
          <Meta label="magicdns" value={board.snapshot.magicDnsEnabled ? board.snapshot.magicDns : "off"} />
        </div>
        <SignalLamp signal={board.signal} />
      </header>

      {board.snapshot.source === "fixture" ? (
        <div className="banner">
          DEMO SIGNAL. Fixture tailnet is driving the board. Set TAILSCALE_API_KEY or run on a host with tailscale status to read the live tailnet.
          {board.snapshot.readerError ? ` ${board.snapshot.readerError}` : ""}
        </div>
      ) : null}

      <section className="alerts" aria-label="open alerts">
        {board.alerts.length === 0 ? (
          <div className="alert-empty">No open alerts. Collector is still watching every jail and exit.</div>
        ) : (
          board.alerts.map((a) => (
            <div key={a.id} className={`alert sev-${a.severity}${a.ackedAt ? " acked" : ""}`}>
              <button
                className="alert-main"
                onClick={() => {
                  if (a.nodeId) {
                    setSelected(a.nodeId);
                    setLocked(true);
                  }
                }}
              >
                <span className="alert-sev">{a.severity}</span>
                <span className="alert-title">{a.title}</span>
                <span className="alert-age">{age(a.openedAt, clock)}</span>
              </button>
              {a.ackedAt ? (
                <span className="alert-ack done">HELD</span>
              ) : (
                <button className="alert-ack" onClick={() => void ackAlert(a.id)}>
                  ACK
                </button>
              )}
            </div>
          ))
        )}
      </section>

      <section className="kpis">
        <KPI label="online" value={`${board.kpi.online}/${board.kpi.total}`} tone={board.kpi.online === board.kpi.total ? "ok" : "warn"} />
        <KPI label="jails" value={`${board.kpi.jails - board.kpi.jailsDown}/${board.kpi.jails}`} tone={board.kpi.jailsDown ? "alarm" : "ok"} />
        <KPI label="exits" value={`${board.kpi.exits - board.kpi.exitsDown}/${board.kpi.exits}`} tone={board.kpi.exitsDown ? "alarm" : "ok"} />
        <KPI label="routers" value={`${board.kpi.routers - board.kpi.routersDown}/${board.kpi.routers}`} tone={board.kpi.routersDown ? "alarm" : "ok"} />
        <KPI label="p95 rtt" value={board.kpi.latencyP95 == null ? "—" : `${Math.round(board.kpi.latencyP95)} ms`} tone={board.kpi.latencyP95 != null && board.kpi.latencyP95 > 150 ? "warn" : "ok"} />
        <KPI label="keys 7d" value={String(board.kpi.keysSoon)} tone={board.kpi.keysSoon ? "warn" : "ok"} />
        <KPI label="health" value={board.kpi.health ? `${board.kpi.health} fault` : "clear"} tone={board.kpi.health ? "alarm" : "ok"} />
      </section>

      <div className="main">
        <section className="grid-wrap">
          <div className="filters">
            {(["all", "jails", "exits", "routers", "offline", "shared"] as Filter[]).map((f) => (
              <button key={f} className={f === filter ? "on" : ""} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
            <button className={locked ? "on" : ""} onClick={() => setLocked((v) => !v)}>
              {locked ? "locked" : "follow"}
            </button>
            <button className={kiosk ? "on" : ""} onClick={() => setKiosk((v) => !v)}>
              kiosk
            </button>
          </div>
          <div className="grid">
            {visible.map((n) => (
              <button
                key={n.id}
                className={`cell state-${n.state} role-${n.role}${n.id === selected ? " sel" : ""}`}
                onClick={() => {
                  setSelected(n.id);
                  setLocked(true);
                }}
              >
                <div className="cell-top">
                  <span className={`lamp state-${n.state}`} />
                  <strong>{n.hostname || n.name || n.id}</strong>
                  <em>{n.role}</em>
                </div>
                <div className="cell-mid">
                  <span>{n.os}</span>
                  <span>{n.relay || "—"}</span>
                  <span>{n.latencyMs == null ? "—" : `${Math.round(n.latencyMs)} ms`}</span>
                </div>
                <Sparkline samples={n.id === detail?.node.id ? historyByNode.get(n.id) ?? samplesFromNode(n) : samplesFromNode(n)} />
                <div className="cell-bot">
                  <span>{(n.addresses ?? [])[0] ?? "no ip"}</span>
                  <span>{n.jail ? "JAIL" : n.tags?.[0] ?? n.user}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="detail">
          {detail ? <NodePanel node={detail.node} history={detail.history ?? []} /> : <div className="empty">Select a node</div>}
        </aside>
      </div>

      <footer className="foot">
        <div className="memo">
          <div className="pane-h">
            <h2>Memo</h2>
            <span>shift notes stay on the glass</span>
          </div>
          <ul>
            {board.memos.slice(0, 4).map((m) => (
              <li key={m.id}>
                <button className="pin" onClick={() => void pinMemo(m.id, !m.pinned)}>
                  {m.pinned ? "PIN" : "pin"}
                </button>
                <b>{m.author}</b>
                <span>{m.body}</span>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!memo.trim()) {
                return;
              }
              void postMemo(author, memo, true).then(() => setMemo(""));
            }}
          >
            <input value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="author" />
            <input id="memo-body" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="pin a note for the next watch" />
            <button type="submit">post</button>
          </form>
        </div>
        <div className="desk">
          <div className="pane-h">
            <h2>AI desk</h2>
            <button onClick={() => void refreshBrief()}>refresh</button>
          </div>
          <p>{board.briefing?.body ?? "Desk is writing the first pass from the current signal."}</p>
          <small>{board.briefing ? `${board.briefing.source} · ${age(board.briefing.createdAt, clock)}` : ""}</small>
        </div>
        <div className="tape">
          <div className="pane-h">
            <h2>Event tape</h2>
          </div>
          <ul>
            {board.events.slice(0, 8).map((e, i) => (
              <li key={e.ts + e.title + i}>
                <time>{fmtTime(e.ts)}</time>
                <span>{e.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}

function NodePanel({ node, history }: { node: Node; history: Sample[] }) {
  return (
    <>
      <div className="pane-h">
        <h2>{node.hostname || node.name}</h2>
        <span className={`pill state-${node.state}`}>{node.state}</span>
      </div>
      <dl>
        <Row k="role" v={node.role} />
        <Row k="os" v={node.os} />
        <Row k="user" v={node.user || "—"} />
        <Row k="version" v={node.clientVersion || "—"} />
        <Row k="tailscale ip" v={(node.addresses ?? []).join(" ") || "—"} />
        <Row k="path" v={node.curAddr || node.relay || node.derp || "unknown"} />
        <Row k="rtt" v={node.latencyMs == null ? "—" : `${node.latencyMs.toFixed(1)} ms`} />
        <Row k="rx / tx" v={`${fmtBytes(node.rxBytes)} / ${fmtBytes(node.txBytes)}`} />
        <Row k="last seen" v={fmtWhen(node.lastSeen)} />
        <Row k="handshake" v={fmtWhen(node.lastHandshake)} />
        <Row k="expires" v={node.keyExpiryDisabled ? "disabled" : fmtWhen(node.expires)} />
        <Row k="routes" v={[...(node.enabledRoutes ?? []), ...(node.advertisedRoutes ?? [])].join(" ") || "none"} />
        <Row k="tags" v={(node.tags ?? []).join(" ") || "—"} />
        <Row k="endpoints" v={(node.endpoints ?? []).slice(0, 2).join(" ") || "—"} />
      </dl>
      <h3>six hour trace</h3>
      <Sparkline samples={history.length ? history : samplesFromNode(node)} width={420} height={72} />
      <p className="trace-note">
        {history.length} samples. Online is the high rail. Offline drops the line. Latency compresses the height.
      </p>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "alarm" }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalLamp({ signal }: { signal: Signal }) {
  return (
    <div className={`signal-lamp sig-${signal}`}>
      <span className="orb" />
      <div>
        <small>signal</small>
        <b>{signal.toUpperCase()}</b>
      </div>
    </div>
  );
}

function matchFilter(n: Node, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "jails":
      return n.jail;
    case "exits":
      return n.exit || n.exitOption;
    case "routers":
      return n.subnet;
    case "offline":
      return !n.online || n.state === "unauthorized" || n.state === "expired";
    case "shared":
      return n.isExternal || n.role === "shared";
    default: {
      const _x: never = f;
      return _x;
    }
  }
}

function samplesFromNode(n: Node): Sample[] {
  return [
    {
      ts: new Date().toISOString(),
      nodeId: n.id,
      online: n.online,
      latencyMs: n.latencyMs,
      rxBytes: n.rxBytes,
      txBytes: n.txBytes,
      relay: n.relay,
      state: n.state,
    },
  ];
}

function fmtClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "--:--";
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtWhen(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString();
}
function age(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) {
    return `${s}s`;
  }
  if (s < 3600) {
    return `${Math.floor(s / 60)}m`;
  }
  return `${Math.floor(s / 3600)}h`;
}
function fmtBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
function beep() {
  const ctx = new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = 880;
  g.gain.value = 0.04;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.12);
}

