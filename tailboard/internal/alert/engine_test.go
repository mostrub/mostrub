package alert

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
	"github.com/mostrub/mostrub/tailboard/internal/reader"
	"github.com/mostrub/mostrub/tailboard/internal/store"
)

func TestFixtureRaisesJailAndUnauthorized(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	eng := &Engine{Store: st}
	// minute % 4 == 0 so jail-plc-03 is offline
	snap := (&reader.Fixture{}).Collect(time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC))
	if _, err := eng.Evaluate(snap); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSnapshot(snap); err != nil {
		t.Fatal(err)
	}
	open, err := st.OpenAlerts()
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[model.AlertKind]int{}
	for _, a := range open {
		kinds[a.Kind]++
	}
	if kinds[model.KindUnauthorized] == 0 {
		t.Fatalf("expected unauthorized alert, got %#v", open)
	}
	if kinds[model.KindNodeOffline] == 0 {
		t.Fatalf("expected offline jail alert, got %#v", open)
	}
	if model.SignalFrom(open) != model.SignalAlarm {
		t.Fatalf("signal=%s", model.SignalFrom(open))
	}
}

func TestResolveWhenNodeReturns(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	eng := &Engine{Store: st}
	lat := 20.0
	down := model.Snapshot{
		CollectedAt: time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC),
		Source:      model.SourceLocal,
		BackendState: "Running",
		Nodes: []model.Node{{
			ID: "n-jail3", Hostname: "jail-plc-03", OS: "freebsd", Authorized: true,
			Online: false, Jail: true, Role: model.RoleJail, State: model.NodeOffline, LatencyMS: &lat,
		}},
	}
	model.Classify(&down.Nodes[0])
	if _, err := eng.Evaluate(down); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordSnapshot(down); err != nil {
		t.Fatal(err)
	}
	up := down
	up.CollectedAt = down.CollectedAt.Add(2 * time.Minute)
	up.Nodes[0].Online = true
	up.Nodes[0].Active = true
	model.Classify(&up.Nodes[0])
	res, err := eng.Evaluate(up)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Resolved) == 0 {
		t.Fatalf("expected resolve, opened=%v", res.Opened)
	}
}
