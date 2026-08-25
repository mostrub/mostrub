package reader

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

func TestAutoCollectErrorsWhenLiveReadersFail(t *testing.T) {
	c := &Collector{
		Mode:    ModeAuto,
		Local:   &Local{Bin: "/no/such/tailscale"},
		Admin:   &Admin{},
		Fixture: &Fixture{},
	}
	_, err := c.Collect(context.Background())
	if err == nil {
		t.Fatal("auto should error when local and admin are both unavailable, not paint the fixture")
	}
}

func TestRecoverKeepsLiveSnapshot(t *testing.T) {
	last := &model.Snapshot{
		Source:  model.SourceAdmin,
		Tailnet: "plant.tailnet",
		Nodes:   []model.Node{{ID: "n-real", Hostname: "nas-core", Authorized: true, Online: true}},
	}
	got := RecoverLiveOrFixture(errors.New("admin 401"), last, time.Date(2026, 8, 25, 14, 0, 0, 0, time.UTC), &Fixture{})
	if got.Source != model.SourceAdmin || got.Tailnet != "plant.tailnet" || len(got.Nodes) != 1 || got.Nodes[0].ID != "n-real" {
		t.Fatalf("expected last-good live snapshot, got %+v", got)
	}
	if got.ReaderError == "" {
		t.Fatal("expected ReaderError stamp")
	}
}

func TestRecoverUsesFixtureWhenNoLiveSnapshot(t *testing.T) {
	got := RecoverLiveOrFixture(errors.New("no creds"), nil, time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC), &Fixture{})
	if got.Source != model.SourceFixture || got.Tailnet != "plant.tailnet" {
		t.Fatalf("expected fixture, got %+v", got)
	}
	if got.ReaderError == "" {
		t.Fatal("expected ReaderError stamp")
	}
}
