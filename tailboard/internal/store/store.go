package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	dsn := path + "?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS samples (
  ts INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  online INTEGER NOT NULL,
  latency_ms REAL,
  rx_bytes INTEGER,
  tx_bytes INTEGER,
  relay TEXT,
  state TEXT,
  PRIMARY KEY (ts, node_id)
);
CREATE INDEX IF NOT EXISTS idx_samples_node ON samples(node_id, ts);

CREATE TABLE IF NOT EXISTS snapshots (
  ts INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS known_nodes (
  node_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  hostname TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  node_id TEXT,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  acked_at INTEGER,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(resolved_at, opened_at);

CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  node_id TEXT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
`)
	return err
}

func (s *Store) RecordSnapshot(snap model.Snapshot) error {
	payload, err := json.Marshal(snap)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	ts := snap.CollectedAt.UnixMilli()
	if _, err := tx.Exec(`INSERT OR REPLACE INTO snapshots(ts, source, payload) VALUES(?,?,?)`, ts, string(snap.Source), string(payload)); err != nil {
		return err
	}
	for _, n := range snap.Nodes {
		var lat any
		if n.LatencyMS != nil {
			lat = *n.LatencyMS
		}
		if _, err := tx.Exec(
			`INSERT OR REPLACE INTO samples(ts, node_id, online, latency_ms, rx_bytes, tx_bytes, relay, state) VALUES(?,?,?,?,?,?,?,?)`,
			ts, n.ID, boolInt(n.Online), lat, n.RxBytes, n.TxBytes, n.Relay, string(n.State),
		); err != nil {
			return err
		}
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO known_nodes(node_id, first_seen, hostname) VALUES(?,?,?)`,
			n.ID, ts, n.Hostname,
		); err != nil {
			return err
		}
	}
	cutoff := snap.CollectedAt.Add(-14 * 24 * time.Hour).UnixMilli()
	if _, err := tx.Exec(`DELETE FROM samples WHERE ts < ?`, cutoff); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM snapshots WHERE ts < ?`, cutoff); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM events WHERE ts < ?`, cutoff); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) LatestSnapshot() (*model.Snapshot, error) {
	var payload string
	err := s.db.QueryRow(`SELECT payload FROM snapshots ORDER BY ts DESC LIMIT 1`).Scan(&payload)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var snap model.Snapshot
	if err := json.Unmarshal([]byte(payload), &snap); err != nil {
		return nil, err
	}
	return &snap, nil
}

func (s *Store) IsKnown(nodeID string) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(1) FROM known_nodes WHERE node_id = ?`, nodeID).Scan(&n)
	return n > 0, err
}

func (s *Store) History(nodeID string, since time.Time) ([]model.Sample, error) {
	rows, err := s.db.Query(
		`SELECT ts, node_id, online, latency_ms, rx_bytes, tx_bytes, relay, state FROM samples WHERE node_id = ? AND ts >= ? ORDER BY ts ASC`,
		nodeID, since.UnixMilli(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Sample
	for rows.Next() {
		var (
			ts     int64
			online int
			lat    sql.NullFloat64
			srow   model.Sample
			state  string
		)
		if err := rows.Scan(&ts, &srow.NodeID, &online, &lat, &srow.RxBytes, &srow.TxBytes, &srow.Relay, &state); err != nil {
			return nil, err
		}
		srow.TS = time.UnixMilli(ts).UTC()
		srow.Online = online == 1
		srow.State = model.NodeState(state)
		if lat.Valid {
			v := lat.Float64
			srow.LatencyMS = &v
		}
		out = append(out, srow)
	}
	return out, rows.Err()
}

func (s *Store) FlapCount(nodeID string, since time.Time) (int, error) {
	var n int
	err := s.db.QueryRow(
		`SELECT COUNT(1) FROM events WHERE node_id = ? AND kind = 'state' AND ts >= ?`,
		nodeID, since.UnixMilli(),
	).Scan(&n)
	return n, err
}

func (s *Store) AddEvent(ev model.Event) error {
	_, err := s.db.Exec(
		`INSERT INTO events(ts, kind, node_id, title, detail) VALUES(?,?,?,?,?)`,
		ev.TS.UnixMilli(), ev.Kind, ev.NodeID, ev.Title, ev.Detail,
	)
	return err
}

func (s *Store) RecentEvents(limit int) ([]model.Event, error) {
	if limit <= 0 {
		limit = 40
	}
	rows, err := s.db.Query(`SELECT ts, kind, node_id, title, detail FROM events ORDER BY ts DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Event
	for rows.Next() {
		var ts int64
		var ev model.Event
		if err := rows.Scan(&ts, &ev.Kind, &ev.NodeID, &ev.Title, &ev.Detail); err != nil {
			return nil, err
		}
		ev.TS = time.UnixMilli(ts).UTC()
		out = append(out, ev)
	}
	return out, rows.Err()
}

func (s *Store) OpenAlerts() ([]model.Alert, error) {
	return s.queryAlerts(`SELECT id, kind, severity, node_id, fingerprint, title, detail, opened_at, acked_at, resolved_at FROM alerts WHERE resolved_at IS NULL ORDER BY opened_at DESC`)
}

func (s *Store) AlertByID(id string) (*model.Alert, error) {
	list, err := s.queryAlerts(`SELECT id, kind, severity, node_id, fingerprint, title, detail, opened_at, acked_at, resolved_at FROM alerts WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return &list[0], nil
}

func (s *Store) OpenByFingerprint(fp string) (*model.Alert, error) {
	list, err := s.queryAlerts(`SELECT id, kind, severity, node_id, fingerprint, title, detail, opened_at, acked_at, resolved_at FROM alerts WHERE fingerprint = ? AND resolved_at IS NULL LIMIT 1`, fp)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return &list[0], nil
}

func (s *Store) InsertAlert(a model.Alert) error {
	_, err := s.db.Exec(
		`INSERT INTO alerts(id, kind, severity, node_id, fingerprint, title, detail, opened_at, acked_at, resolved_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
		a.ID, string(a.Kind), string(a.Severity), a.NodeID, a.Fingerprint, a.Title, a.Detail, a.OpenedAt.UnixMilli(), millisPtr(a.AckedAt), millisPtr(a.ResolvedAt),
	)
	return err
}

func (s *Store) ResolveAlert(id string, at time.Time) error {
	_, err := s.db.Exec(`UPDATE alerts SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL`, at.UnixMilli(), id)
	return err
}

func (s *Store) AckAlert(id string, at time.Time) error {
	_, err := s.db.Exec(`UPDATE alerts SET acked_at = ? WHERE id = ? AND resolved_at IS NULL`, at.UnixMilli(), id)
	return err
}

func (s *Store) InsertMemo(m model.Memo) error {
	_, err := s.db.Exec(
		`INSERT INTO memos(id, author, body, pinned, created_at) VALUES(?,?,?,?,?)`,
		m.ID, m.Author, m.Body, boolInt(m.Pinned), m.CreatedAt.UnixMilli(),
	)
	return err
}

func (s *Store) SetMemoPin(id string, pinned bool) error {
	_, err := s.db.Exec(`UPDATE memos SET pinned = ? WHERE id = ?`, boolInt(pinned), id)
	return err
}

func (s *Store) Memos() ([]model.Memo, error) {
	rows, err := s.db.Query(`SELECT id, author, body, pinned, created_at FROM memos ORDER BY pinned DESC, created_at DESC LIMIT 40`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Memo
	for rows.Next() {
		var ts, pin int64
		var m model.Memo
		if err := rows.Scan(&m.ID, &m.Author, &m.Body, &pin, &ts); err != nil {
			return nil, err
		}
		m.Pinned = pin == 1
		m.CreatedAt = time.UnixMilli(ts).UTC()
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) InsertBriefing(b model.Briefing) error {
	_, err := s.db.Exec(`INSERT INTO briefings(id, source, body, created_at) VALUES(?,?,?,?)`, b.ID, b.Source, b.Body, b.CreatedAt.UnixMilli())
	return err
}

func (s *Store) LatestBriefing() (*model.Briefing, error) {
	var b model.Briefing
	var ts int64
	err := s.db.QueryRow(`SELECT id, source, body, created_at FROM briefings ORDER BY created_at DESC LIMIT 1`).Scan(&b.ID, &b.Source, &b.Body, &ts)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	b.CreatedAt = time.UnixMilli(ts).UTC()
	return &b, nil
}

func (s *Store) queryAlerts(q string, args ...any) ([]model.Alert, error) {
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Alert
	for rows.Next() {
		var opened int64
		var acked, resolved sql.NullInt64
		var a model.Alert
		var kind, sev string
		if err := rows.Scan(&a.ID, &kind, &sev, &a.NodeID, &a.Fingerprint, &a.Title, &a.Detail, &opened, &acked, &resolved); err != nil {
			return nil, err
		}
		a.Kind = model.AlertKind(kind)
		a.Severity = model.Severity(sev)
		a.OpenedAt = time.UnixMilli(opened).UTC()
		if acked.Valid {
			t := time.UnixMilli(acked.Int64).UTC()
			a.AckedAt = &t
		}
		if resolved.Valid {
			t := time.UnixMilli(resolved.Int64).UTC()
			a.ResolvedAt = &t
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func millisPtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UnixMilli()
}

func NewID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func Fingerprint(kind model.AlertKind, nodeID string) string {
	if strings.TrimSpace(nodeID) == "" {
		return string(kind)
	}
	return string(kind) + ":" + nodeID
}
