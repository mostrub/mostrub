package reader

import (
	"context"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

type Mode string

const (
	ModeAuto    Mode = "auto"
	ModeAdmin   Mode = "admin"
	ModeLocal   Mode = "local"
	ModeFixture Mode = "fixture"
)

type Collector struct {
	Mode    Mode
	Admin   *Admin
	Local   *Local
	Fixture *Fixture
}

func (c *Collector) Collect(ctx context.Context) (model.Snapshot, error) {
	mode := c.Mode
	if mode == "" {
		mode = ModeAuto
	}
	switch mode {
	case ModeFixture:
		return c.Fixture.Collect(time.Now().UTC()), nil
	case ModeAdmin:
		if c.Admin == nil || !c.Admin.Enabled() {
			return model.Snapshot{}, errReader("admin mode needs TAILSCALE_API_KEY or OAuth client")
		}
		return c.Admin.Collect(ctx)
	case ModeLocal:
		if c.Local == nil {
			return model.Snapshot{}, errReader("local mode needs tailscale CLI")
		}
		return c.Local.Collect(ctx)
	default:
		var localSnap model.Snapshot
		var adminSnap model.Snapshot
		var localErr, adminErr error
		if c.Local != nil {
			localSnap, localErr = c.Local.Collect(ctx)
		} else {
			localErr = errReader("no local reader")
		}
		if c.Admin != nil && c.Admin.Enabled() {
			adminSnap, adminErr = c.Admin.Collect(ctx)
		} else {
			adminErr = errReader("no admin credentials")
		}
		if localErr == nil && adminErr == nil {
			return mergeSnaps(localSnap, adminSnap), nil
		}
		if localErr == nil {
			return localSnap, nil
		}
		if adminErr == nil {
			return adminSnap, nil
		}
		return model.Snapshot{}, errReader("live readers unavailable; local: " + localErr.Error() + "; admin: " + adminErr.Error())
	}
}

// RecoverLiveOrFixture keeps a live last-good snapshot when readers fail.
// The fixture is only used when no live inventory has ever been stored.
func RecoverLiveOrFixture(err error, last *model.Snapshot, now time.Time, fixture *Fixture) model.Snapshot {
	msg := "live readers unavailable"
	if err != nil {
		msg = err.Error()
	}
	if last != nil && last.Source != model.SourceFixture {
		keep := *last
		keep.CollectedAt = now
		keep.ReaderError = msg
		return keep
	}
	var snap model.Snapshot
	if fixture != nil {
		snap = fixture.Collect(now)
	} else {
		snap = model.Snapshot{CollectedAt: now, Source: model.SourceFixture, BackendState: "Unknown"}
	}
	snap.ReaderError = msg
	return snap
}

type readerError string

func (e readerError) Error() string { return string(e) }

func errReader(s string) error { return readerError(s) }

func mergeSnaps(local, admin model.Snapshot) model.Snapshot {
	out := local
	out.Source = model.SourceMerged
	out.CollectedAt = time.Now().UTC()
	if out.Tailnet == "" {
		out.Tailnet = admin.Tailnet
	}
	if len(out.Nameservers) == 0 {
		out.Nameservers = admin.Nameservers
	}
	if !out.MagicDNSOn {
		out.MagicDNSOn = admin.MagicDNSOn
	}
	byID := map[string]int{}
	for i, n := range out.Nodes {
		byID[n.ID] = i
		if n.Hostname != "" {
			byID[n.Hostname] = i
		}
	}
	for _, a := range admin.Nodes {
		idx, ok := byID[a.ID]
		if !ok {
			idx, ok = byID[a.Hostname]
		}
		if !ok {
			out.Nodes = append(out.Nodes, a)
			continue
		}
		n := &out.Nodes[idx]
		if n.User == "" {
			n.User = a.User
		}
		if n.ClientVersion == "" {
			n.ClientVersion = a.ClientVersion
		}
		n.Authorized = a.Authorized
		n.UpdateAvailable = a.UpdateAvailable
		n.KeyExpiryOff = a.KeyExpiryOff
		n.IsExternal = a.IsExternal || n.IsExternal
		n.IsEphemeral = a.IsEphemeral
		if len(a.AdvertisedRoutes) > 0 {
			n.AdvertisedRoutes = a.AdvertisedRoutes
		}
		if len(a.EnabledRoutes) > 0 {
			n.EnabledRoutes = a.EnabledRoutes
		}
		if len(a.Endpoints) > 0 {
			n.Endpoints = a.Endpoints
		}
		if a.Expires != nil {
			n.Expires = a.Expires
		}
		if n.LatencyMS == nil {
			n.LatencyMS = a.LatencyMS
		}
		if n.DERP == "" {
			n.DERP = a.DERP
		}
		model.Classify(n)
	}
	return out
}
