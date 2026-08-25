# Tailboard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single-binary Tailscale operations board with a real reader, SQLite history, always-on alerts, operator memos, an AI desk, and a 4K/TV UI.

**Architecture:** Go process polls Admin API and/or `tailscale status --json`, stores samples, evaluates alerts, serves SSE + a React board embedded in the binary.

**Tech Stack:** Go 1.22, modernc.org/sqlite, Vite, React 18, TypeScript.

## Global Constraints

- Module path `github.com/mostrub/mostrub/tailboard`
- Listen default `:4747`
- No secrets in git
- Fixture mode when no Tailscale credentials exist
- Discriminated unions for alert kind and signal
- Tests cover parse, store, and alert engine before the UI is called done

---

### Task 1: Domain, store, Tailscale readers, alerts, HTTP

**Files:**
- Create: `tailboard/go.mod`
- Create: `tailboard/internal/model/model.go`
- Create: `tailboard/internal/store/store.go`
- Create: `tailboard/internal/store/store_test.go`
- Create: `tailboard/internal/reader/*.go` and parse tests
- Create: `tailboard/internal/alert/engine.go` and tests
- Create: `tailboard/internal/brief/brief.go`
- Create: `tailboard/internal/server/server.go`
- Create: `tailboard/cmd/tailboard/main.go`
- Create: `tailboard/testdata/fixture.json`

- [x] Implement and test the collector
- [x] Commit with the board

### Task 2: 4K board

**Files:**
- Create: `tailboard/web/*`

- [x] Industrial TV board talking to `/api/*`
- [x] Embed `web/dist` in the Go binary

### Task 3: Verify

- [x] `go test ./...`
- [x] `npm run build`
- [x] Run fixture mode and exercise the board
