package alert

import (
	"fmt"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
	"github.com/mostrub/mostrub/tailboard/internal/store"
)

type Engine struct {
	Store         *store.Store
	OfflineAfter  time.Duration
	KeySoon       time.Duration
	LatencyMS     float64
	FlapWindow    time.Duration
	FlapThreshold int
}

type Result struct {
	Opened   []model.Alert
	Resolved []model.Alert
}

func (e *Engine) Evaluate(snap model.Snapshot) (Result, error) {
	now := snap.CollectedAt
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if e.OfflineAfter == 0 {
		e.OfflineAfter = 90 * time.Second
	}
	if e.KeySoon == 0 {
		e.KeySoon = 7 * 24 * time.Hour
	}
	if e.LatencyMS == 0 {
		e.LatencyMS = 150
	}
	if e.FlapWindow == 0 {
		e.FlapWindow = 15 * time.Minute
	}
	if e.FlapThreshold == 0 {
		e.FlapThreshold = 4
	}

	prevSnap, err := e.Store.LatestSnapshot()
	if err != nil {
		return Result{}, err
	}

	desired := map[string]model.Alert{}
	add := func(kind model.AlertKind, sev model.Severity, nodeID, title, detail string) {
		fp := store.Fingerprint(kind, nodeID)
		desired[fp] = model.Alert{
			Kind:        kind,
			Severity:    sev,
			NodeID:      nodeID,
			Fingerprint: fp,
			Title:       title,
			Detail:      detail,
			OpenedAt:    now,
		}
	}

	if snap.ReaderError != "" && snap.Source == model.SourceFixture {
		add(model.KindReaderError, model.SeverityWarning, "", "Live Tailscale reader down", snap.ReaderError)
	} else if snap.ReaderError != "" {
		add(model.KindReaderError, model.SeverityCritical, "", "Tailscale reader error", snap.ReaderError)
	}
	if snap.Source != model.SourceAdmin && snap.BackendState != "" && snap.BackendState != "Running" {
		add(model.KindControlDown, model.SeverityCritical, "", "tailscaled is "+snap.BackendState, "Local backend state is "+snap.BackendState+". The board cannot trust peer liveness until it is Running.")
	}
	for _, h := range snap.Health {
		add(model.KindHealth, model.SeverityCritical, "", "tailscaled health fault", h)
	}

	for _, n := range snap.Nodes {
		name := model.DisplayName(n)
		if !n.Authorized {
			add(model.KindUnauthorized, model.SeverityCritical, n.ID, name+" is unauthorized", name+" is on the tailnet but not authorized. Isolate it or approve it in the admin console.")
		}
		if n.UpdateAvailable {
			add(model.KindUpdate, model.SeverityInfo, n.ID, name+" has a client update", name+" reports updateAvailable from the control plane.")
		}
		if n.Expires != nil && !n.KeyExpiryOff && n.Expires.After(now) && n.Expires.Before(now.Add(e.KeySoon)) {
			add(model.KindKeyExpiry, model.SeverityWarning, n.ID, name+" key expires soon", fmt.Sprintf("%s node key expires %s.", name, n.Expires.UTC().Format(time.RFC3339)))
		}
		if n.LatencyMS != nil && *n.LatencyMS > e.LatencyMS && n.Online {
			add(model.KindHighLatency, model.SeverityWarning, n.ID, name+" high path latency", fmt.Sprintf("%s RTT is %.0f ms (limit %.0f ms).", name, *n.LatencyMS, e.LatencyMS))
		}
		if prevSnap != nil {
			known, err := e.Store.IsKnown(n.ID)
			if err != nil {
				return Result{}, err
			}
			if !known {
				add(model.KindNewNode, model.SeverityWarning, n.ID, "New node "+name, name+" appeared on the reader for the first time.")
			}
		}
		criticalOffline := n.Jail || n.Exit || n.ExitOption || n.Subnet
		if !n.Online && n.Authorized && !n.Self {
			stale := true
			if n.LastSeen != nil && now.Sub(*n.LastSeen) < e.OfflineAfter && !criticalOffline {
				stale = false
			}
			if stale || criticalOffline {
				sev := model.SeverityWarning
				if criticalOffline {
					sev = model.SeverityCritical
				}
				why := "peer is offline"
				if n.Jail {
					why = "jail is offline"
				} else if n.Exit || n.ExitOption {
					why = "exit node is offline"
				} else if n.Subnet {
					why = "subnet router is offline"
				}
				add(model.KindNodeOffline, sev, n.ID, name+" "+why, name+" last seen "+formatSeen(n.LastSeen)+". Role "+string(n.Role)+".")
			}
		}
		flaps, err := e.Store.FlapCount(n.ID, now.Add(-e.FlapWindow))
		if err != nil {
			return Result{}, err
		}
		if flaps >= e.FlapThreshold {
			add(model.KindNodeFlap, model.SeverityWarning, n.ID, name+" is flapping", fmt.Sprintf("%s changed state %d times in %s.", name, flaps, e.FlapWindow))
		}
	}

	open, err := e.Store.OpenAlerts()
	if err != nil {
		return Result{}, err
	}
	have := map[string]model.Alert{}
	for _, a := range open {
		have[a.Fingerprint] = a
	}

	var res Result
	for fp, want := range desired {
		if _, ok := have[fp]; ok {
			continue
		}
		want.ID = store.NewID("al")
		if err := e.Store.InsertAlert(want); err != nil {
			return Result{}, err
		}
		_ = e.Store.AddEvent(model.Event{TS: now, Kind: "alert", NodeID: want.NodeID, Title: want.Title, Detail: want.Detail})
		res.Opened = append(res.Opened, want)
	}
	for fp, got := range have {
		if _, ok := desired[fp]; ok {
			continue
		}
		if err := e.Store.ResolveAlert(got.ID, now); err != nil {
			return Result{}, err
		}
		got.ResolvedAt = &now
		_ = e.Store.AddEvent(model.Event{TS: now, Kind: "clear", NodeID: got.NodeID, Title: "cleared: " + got.Title, Detail: got.Detail})
		res.Resolved = append(res.Resolved, got)
	}

	if err := e.recordStateChanges(prevSnap, snap, now); err != nil {
		return Result{}, err
	}
	return res, nil
}

func (e *Engine) recordStateChanges(prev *model.Snapshot, snap model.Snapshot, now time.Time) error {
	if prev == nil {
		return nil
	}
	old := map[string]model.Node{}
	for _, n := range prev.Nodes {
		old[n.ID] = n
	}
	for _, n := range snap.Nodes {
		p, ok := old[n.ID]
		if !ok || p.State == n.State {
			continue
		}
		if err := e.Store.AddEvent(model.Event{
			TS:     now,
			Kind:   "state",
			NodeID: n.ID,
			Title:  model.DisplayName(n) + " " + string(p.State) + " → " + string(n.State),
			Detail: "role " + string(n.Role),
		}); err != nil {
			return err
		}
	}
	return nil
}

func formatSeen(t *time.Time) string {
	if t == nil {
		return "never"
	}
	return t.UTC().Format(time.RFC3339)
}
