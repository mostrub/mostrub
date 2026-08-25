package reader

import (
	"math"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

type Fixture struct{}

func (f *Fixture) Collect(now time.Time) model.Snapshot {
	now = now.UTC()
	minute := now.Minute()
	wave := 40 + 18*math.Sin(float64(now.Unix())/40)
	jailDown := minute%4 == 0
	exitLat := 42.0 + wave
	if minute%5 == 0 {
		exitLat = 210
	}
	plcBOnline := minute%7 != 0

	nodes := []model.Node{
		node("n-self", "edge-macbook", "edge-macbook.plant.ts.net", "macOS", "marc@plant.local", []string{"100.64.1.1"}, nil, true, true, true, false, false, false, 12, "direct", now),
		node("n-scada", "shop-win-scada", "shop-win-scada.plant.ts.net", "windows", "ot@plant.local", []string{"100.64.1.10"}, []string{"tag:ot"}, true, true, true, false, false, false, 18, "direct", now.Add(-20*time.Second)),
		node("n-gate", "pi-gate-01", "pi-gate-01.plant.ts.net", "linux", "ot@plant.local", []string{"100.64.1.20"}, []string{"tag:router"}, true, true, true, false, true, false, 28, "sfo", now.Add(-8*time.Second)),
		node("n-exit", "exit-nyc", "exit-nyc.plant.ts.net", "linux", "net@plant.local", []string{"100.64.1.30"}, []string{"tag:exit"}, true, true, true, true, false, false, exitLat, "nyc", now.Add(-3*time.Second)),
		node("n-jail1", "jail-hmi-01", "jail-hmi-01.plant.ts.net", "freebsd", "ot@plant.local", []string{"100.64.2.1"}, []string{"tag:jail"}, true, true, true, false, false, false, 22, "direct", now.Add(-11*time.Second)),
		node("n-jail2", "jail-hist-02", "jail-hist-02.plant.ts.net", "freebsd", "ot@plant.local", []string{"100.64.2.2"}, []string{"tag:jail"}, true, true, false, false, false, false, 31, "chi", now.Add(-40*time.Second)),
		node("n-jail3", "jail-plc-03", "jail-plc-03.plant.ts.net", "freebsd", "ot@plant.local", []string{"100.64.2.3"}, []string{"tag:jail"}, true, !jailDown, !jailDown, false, false, false, 55, "chi", now.Add(-2*time.Minute)),
		node("n-nas", "nas-core", "nas-core.plant.ts.net", "freebsd", "it@plant.local", []string{"100.64.3.1"}, []string{"tag:storage"}, true, true, true, false, true, false, 16, "direct", now.Add(-5*time.Second)),
		node("n-plca", "plc-line-a", "plc-line-a.plant.ts.net", "linux", "ot@plant.local", []string{"100.64.4.1"}, []string{"tag:ot"}, true, true, true, false, false, false, 9, "direct", now.Add(-6*time.Second)),
		node("n-plcb", "plc-line-b", "plc-line-b.plant.ts.net", "linux", "ot@plant.local", []string{"100.64.4.2"}, []string{"tag:ot"}, true, plcBOnline, plcBOnline, false, false, false, 14, "sfo", now.Add(-90*time.Second)),
		node("n-eng", "laptop-eng", "laptop-eng.plant.ts.net", "macOS", "eng@plant.local", []string{"100.64.5.1"}, nil, true, true, false, false, false, false, 70, "nyc", now.Add(-3*time.Minute)),
		node("n-phone", "phone-marc", "phone-marc.plant.ts.net", "iOS", "marc@plant.local", []string{"100.64.5.8"}, nil, true, true, true, false, false, false, 88, "nyc", now.Add(-15*time.Second)),
		node("n-share", "vendor-shared", "vendor-shared.other.ts.net", "linux", "vendor@other.example", []string{"100.91.8.4"}, nil, true, true, false, false, false, true, 120, "sea", now.Add(-25*time.Second)),
		node("n-new", "spare-laptop", "spare-laptop.plant.ts.net", "windows", "unknown", []string{"100.64.9.9"}, nil, false, true, true, false, false, false, 40, "sfo", now),
		node("n-cam", "cam-west", "cam-west.plant.ts.net", "linux", "ot@plant.local", []string{"100.64.6.12"}, []string{"tag:camera"}, true, true, true, false, false, false, 26, "sfo", now.Add(-4*time.Second)),
	}
	nodes[0].Self = true
	nodes[2].EnabledRoutes = []string{"10.10.0.0/16"}
	nodes[2].AdvertisedRoutes = []string{"10.10.0.0/16"}
	nodes[3].ExitOption = true
	nodes[3].Exit = true
	nodes[7].EnabledRoutes = []string{"172.16.8.0/24"}
	exp := now.Add(36 * time.Hour)
	nodes[14].Expires = &exp
	nodes[13].Authorized = false
	nodes[10].UpdateAvailable = true
	if !plcBOnline {
		seen := now.Add(-12 * time.Minute)
		nodes[9].LastSeen = &seen
	}
	if jailDown {
		seen := now.Add(-3 * time.Minute)
		nodes[6].LastSeen = &seen
	}
	for i := range nodes {
		model.Classify(&nodes[i])
	}

	health := []string(nil)
	if minute%11 == 0 {
		health = []string{"DERP map is stale; last refresh 12m ago"}
	}

	return model.Snapshot{
		CollectedAt:  now,
		Source:       model.SourceFixture,
		Tailnet:      "plant.tailnet",
		MagicDNS:     "plant.ts.net",
		MagicDNSOn:   true,
		BackendState: "Running",
		Health:       health,
		Nameservers:  []string{"100.100.100.100"},
		SelfID:       "n-self",
		Nodes:        nodes,
	}
}

func node(id, host, name, os, user string, addrs, tags []string, auth, online, active, exit, subnet, shared bool, lat float64, relay string, seen time.Time) model.Node {
	created := seen.Add(-90 * 24 * time.Hour)
	expires := seen.Add(120 * 24 * time.Hour)
	latc := lat
	n := model.Node{
		ID:             id,
		NodeID:         id,
		Hostname:       host,
		Name:           name,
		OS:             os,
		User:           user,
		ClientVersion:  "1.76.6",
		Addresses:      addrs,
		Tags:           tags,
		Authorized:     auth,
		Online:         online,
		Active:         active,
		Exit:           exit,
		ExitOption:     exit,
		Subnet:         subnet,
		IsExternal:     shared,
		Relay:          relay,
		LatencyMS:      &latc,
		RxBytes:        int64(2_000_000 + lat*1000),
		TxBytes:        int64(1_400_000 + lat*800),
		LastSeen:       &seen,
		Created:        &created,
		Expires:        &expires,
	}
	if relay == "direct" {
		n.CurAddr = "203.0.113.10:41641"
	} else {
		n.DERP = relay
	}
	return n
}
