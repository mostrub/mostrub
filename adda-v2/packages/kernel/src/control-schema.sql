CREATE SCHEMA IF NOT EXISTS control;

CREATE TABLE IF NOT EXISTS control.operators (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.cases (
  id TEXT PRIMARY KEY,
  dmc TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  opened_by TEXT NOT NULL,
  closed_at TIMESTAMPTZ,
  snapshot_id BIGINT
);

CREATE TABLE IF NOT EXISTS control.dispositions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES control.cases(id),
  decision TEXT NOT NULL,
  note TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  decided_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control.audit_events (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS control.snapshot_pins (
  id TEXT PRIMARY KEY,
  snapshot_id BIGINT NOT NULL,
  case_id TEXT NOT NULL REFERENCES control.cases(id),
  label TEXT NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL,
  pinned_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cases_dmc_idx ON control.cases (dmc);
CREATE INDEX IF NOT EXISTS cases_status_idx ON control.cases (status);
CREATE INDEX IF NOT EXISTS audit_at_idx ON control.audit_events (at DESC);
CREATE INDEX IF NOT EXISTS dispositions_case_idx ON control.dispositions (case_id, decided_at DESC);
