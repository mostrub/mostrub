# Tailboard design

Tailboard is a local Tailscale operations board. It runs as one process on a Mac, Linux box, Windows machine, or small edge host, and fills a 4K TV or desktop monitor with live node state, history, and alerts.

The board is an industrial signal, not a settings page. The whole tailnet has one presentable state: CLEAR, ADVISORY, or ALARM. Every node, including isolated "jail" hosts, keeps a history so operators can see what changed over time.

## Why this exists

Marc runs OT/IT and edge systems. Tailscale already connects the machines. What is missing is a wall display that keeps watching after you look away, records each node over time, and raises an alarm when a jail, exit node, or subnet router drops.

Bare status pages fail that job. They show a snapshot and go quiet. Tailboard keeps polling, stores samples, and will not stop alerting because the UI is idle.

## Approaches considered

1. **Single Go binary, SQLite, embedded 4K board (chosen).** Cross-compiles for Mac, Linux, and Windows. Low RAM. No runtime install on the TV host. One URL in a kiosk browser.
2. Node + better-sqlite3 + Vite. Faster to sketch a UI, worse on a Pi and awkward on Windows because of native modules.
3. Prometheus exporter plus Grafana. Strong history, heavy to run, not a dedicated signal, and needs more than one service.

## Tailscale reader

The collector never invents Tailscale fields. It maps published APIs into one internal snapshot.

**Admin API** (`https://api.tailscale.com/api/v2`)

- Auth: `Authorization: Bearer tskey-api-...` or HTTP Basic with the key as the username. OAuth client credentials against `/api/v2/oauth/token` when `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_CLIENT_SECRET` are set.
- `GET /tailnet/{tailnet}/devices?fields=all` for inventory, `connectedToControl`, `lastSeen`, routes, `clientConnectivity` (DERP, endpoints, latency, clientSupports), key expiry, tags, authorization.
- `GET /tailnet/{tailnet}/dns/nameservers` and `/dns/preferences` for MagicDNS context.
- `GET /tailnet/{tailnet}/keys` for auth-key expiry.
- Tailnet path `-` means the default tailnet for the credential.

**Local reader** (same host as `tailscaled`)

- `tailscale status --json` (LocalAPI `/localapi/v0/status`). Fields used: `BackendState`, `Health`, `CurrentTailnet`, `Self`, `Peer.*.Online`, `Active`, `Relay`, `RxBytes`, `TxBytes`, `CurAddr`, `LastSeen`, `LastHandshake`, `ExitNode`, `ExitNodeOption`, `Expired`, `KeyExpiry`, `Tags`, `AllowedIPs`.
- Optional `tailscale ping --c 1 --timeout 2s` on a sample of peers for live RTT.
- Optional `tailscale netcheck --format=json` for this host's DERP map.

**Merge rule.** Local status wins for live path (online, relay, bytes, handshake). Admin API wins for authorization, advertised/enabled routes, key expiry policy, and DERP latency maps. Both run when available.

**Fixture reader.** Ships a full industrial tailnet so the board always works without credentials. Time-varying mutations keep history and alerts honest in demo mode.

Mode `auto` tries local, then admin, then fixture. A yellow banner states the source so a demo signal is never mistaken for production.

## Domain

A **node** is one Tailscale device. A **jail** is a node whose tags include `tag:jail`, whose hostname contains `jail`, or whose OS is FreeBSD. Those nodes get their own filter and lamp on the board because isolated process hosts are easy to lose in a flat list.

Node roles: `self`, `exit`, `subnet`, `jail`, `shared`, `workstation`.

**Signal**

- ALARM: any critical open alert (offline exit/subnet/jail, unauthorized device, tailscaled not Running, health fault).
- ADVISORY: warnings only (key expiry, high DERP latency, updates, flap recovered).
- CLEAR: no open alerts.

## Alerts that always run

The engine evaluates every snapshot. Open alerts stay open until the condition clears. Acknowledging silences the lamp but does not delete the record.

| Kind | Severity | Trip |
| --- | --- | --- |
| `control_down` | critical | backend state is not `Running` |
| `health` | critical | tailscaled health strings present |
| `node_offline` | critical | node was online, now offline longer than 90s; exit/subnet/jail always critical |
| `unauthorized` | critical | `authorized == false` |
| `new_node` | warning | first time this node ID is seen |
| `key_expiry` | warning | node key expires within 7 days and expiry is not disabled |
| `high_latency` | warning | preferred DERP or ping RTT over 150ms |
| `node_flap` | warning | online/offline changed 4+ times in 15 minutes |
| `update` | info | `updateAvailable` |

Delivery: in-board ticker, browser beep on new critical, optional webhook POST with JSON `{alert, node, signal}`.

## Storage

SQLite at `TAILBOARD_DATA` (default `./tailboard.db`).

- `samples`: per-node online, latency, bytes, relay, state. 15s local / 60s admin.
- `alerts`, `events`, `memos`, `briefings`.
- Retain samples 14 days. Prune on each poll.

The process must keep writing while the browser is closed. The board is a client of the store, not the other way around.

## AI desk

`POST` an OpenAI-compatible chat completion when `TAILBOARD_AI_URL` and `TAILBOARD_AI_KEY` are set. Input is the current signal, open alerts, offline jails, and last memos. Output is a short operator briefing stored in `briefings`.

If no model is configured, a rule writer still produces a briefing from the same facts. The desk is never blank.

## HTTP surface

One listener, default `:4747`.

- `GET /api/board` full board payload
- `GET /api/nodes/:id` node plus history
- `GET /api/alerts` `POST /api/alerts/:id/ack`
- `GET|POST /api/memos` `POST /api/memos/:id/pin`
- `GET /api/briefing` `POST /api/briefing/refresh`
- `GET /api/stream` Server-Sent Events
- `GET /api/health`

The Vite board is embedded with `go:embed` and served at `/`.

## Board (4K / TV)

Distance-readable. Base type scales with `clamp(16px, 0.9vw, 28px)`. No hover-only actions. Keyboard: arrows move node focus, Enter opens detail, A acknowledges the selected alert, M focuses the memo box.

Layout

1. Masthead: clock, tailnet name, reader source, backend state, signal lamp.
2. Alert rail: open incidents, newest first.
3. KPI strip: online/total, jails, exits, routers, p95 latency, keys expiring, health.
4. Node grid with 20-minute sparklines. Filter chips: all, jails, exits, routers, offline, shared.
5. Selected node column: identity, path (direct vs DERP), routes, endpoints, 6-hour history, last events.
6. Footer: pinned memos, AI desk, recent event tape.

Kiosk mode auto-advances the selected node every 20s unless the operator locks it.

Palette is an HMI, not a marketing site: near-black panels, green/amber/red lamps, cyan for info.

## Platforms

| Host | How |
| --- | --- |
| Linux / Pi | `GOOS=linux GOARCH=arm64` binary, Chromium kiosk to `http://host:4747` |
| macOS | same binary, Safari or Chrome full screen |
| Windows | `GOOS=windows` `.exe`, Edge kiosk |

RAM target: under 64MB for the process on a 20-node tailnet.

## Always-on rules

- No credentials: fixture mode, banner, alerts still fire on the simulated tailnet.
- Credentials fail: last good snapshot stays on the board, a critical `reader_error` alert opens.
- Browser closed: poller and webhooks continue.
- Clock skew: sample timestamps come from the collector host.

## Out of scope

ACL editing, device authorization writes, log-stream setup, and multi-user auth on the board itself. Tailboard is a reader and a signal, not an admin console.
