package store

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

func TestRecordAndHistory(t *testing.T) {
	st := openTest(t)
	now := time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC)
	lat := 22.0
	snap := model.Snapshot{
		CollectedAt: now,
		Source:      model.SourceFixture,
		Tailnet:     "plant.tailnet",
		Nodes: []model.Node{{
			ID: "n-jail3", Hostname: "jail-plc-03", Online: false, State: model.NodeOffline, LatencyMS: &lat,
		}},
	}
	if err := st.RecordSnapshot(snap); err != nil {
		t.Fatal(err)
	}
	known, err := st.IsKnown("n-jail3")
	if err != nil || !known {
		t.Fatalf("known=%v err=%v", known, err)
	}
	hist, err := st.History("n-jail3", now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(hist) != 1 || hist[0].Online {
		t.Fatalf("history=%+v", hist)
	}
	got, err := st.LatestSnapshot()
	if err != nil || got == nil || got.Tailnet != "plant.tailnet" {
		t.Fatalf("latest=%+v err=%v", got, err)
	}
}

func TestAlertLifecycle(t *testing.T) {
	st := openTest(t)
	now := time.Now().UTC()
	a := model.Alert{
		ID: "al-1", Kind: model.KindNodeOffline, Severity: model.SeverityCritical,
		NodeID: "n-jail3", Fingerprint: Fingerprint(model.KindNodeOffline, "n-jail3"),
		Title: "jail-plc-03 jail is offline", Detail: "down", OpenedAt: now,
	}
	if err := st.InsertAlert(a); err != nil {
		t.Fatal(err)
	}
	open, err := st.OpenAlerts()
	if err != nil || len(open) != 1 {
		t.Fatalf("open=%v err=%v", open, err)
	}
	if err := st.AckAlert("al-1", now); err != nil {
		t.Fatal(err)
	}
	if err := st.ResolveAlert("al-1", now); err != nil {
		t.Fatal(err)
	}
	open, err = st.OpenAlerts()
	if err != nil || len(open) != 0 {
		t.Fatalf("expected resolved, got %v", open)
	}
}

func openTest(t *testing.T) *Store {
	t.Helper()
	st, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}
