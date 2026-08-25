package model

import (
	"testing"
	"time"
)

func TestSignalFromSkipsAckedAlerts(t *testing.T) {
	acked := time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC)
	alerts := []Alert{{
		Kind: KindUnauthorized, Severity: SeverityCritical, Title: "laptop unauthorized", AckedAt: &acked,
	}}
	if got := SignalFrom(alerts); got != SignalClear {
		t.Fatalf("acked critical should silence lamp, got %s", got)
	}
	alerts = append(alerts, Alert{Kind: KindKeyExpiry, Severity: SeverityWarning, Title: "key soon"})
	if got := SignalFrom(alerts); got != SignalAdvisory {
		t.Fatalf("unacked warning should keep advisory, got %s", got)
	}
}

func TestClassifyDefaultRouteIsExitNotOnlyRouter(t *testing.T) {
	n := Node{
		ID: "n-exit", Hostname: "exit-nyc", Authorized: true, Online: true,
		AdvertisedRoutes: []string{"0.0.0.0/0", "::/0"},
		EnabledRoutes:    []string{"0.0.0.0/0"},
	}
	Classify(&n)
	if !n.Exit || n.Role != RoleExit {
		t.Fatalf("default route should be exit, got exit=%v role=%s", n.Exit, n.Role)
	}
	if n.Subnet {
		t.Fatalf("default-only routes should not count as subnet router")
	}
}

func TestClassifyHostRouteIsSubnet(t *testing.T) {
	n := Node{
		ID: "n-ot", Hostname: "plc-gw", Authorized: true, Online: true,
		Addresses:     []string{"100.64.1.40"},
		EnabledRoutes: []string{"192.168.1.50/32"},
	}
	Classify(&n)
	if !n.Subnet || n.Role != RoleSubnet {
		t.Fatalf("host route should be subnet, got subnet=%v role=%s", n.Subnet, n.Role)
	}
}
