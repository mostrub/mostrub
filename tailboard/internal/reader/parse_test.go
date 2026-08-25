package reader

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAdminDeviceParse(t *testing.T) {
	raw := []byte(`{
	  "devices": [{
	    "addresses": ["100.105.58.116"],
	    "id": "12345",
	    "nodeId": "nAbc",
	    "user": "user1@example.com",
	    "name": "jail-hmi-01.example.com",
	    "hostname": "jail-hmi-01",
	    "clientVersion": "1.76.6",
	    "updateAvailable": false,
	    "os": "freebsd",
	    "created": "2020-11-20T20:56:49Z",
	    "lastSeen": "2020-11-20T21:15:55Z",
	    "keyExpiryDisabled": false,
	    "expires": "2021-05-19T20:56:49Z",
	    "authorized": true,
	    "isExternal": false,
	    "connectedToControl": true,
	    "enabledRoutes": [],
	    "advertisedRoutes": [],
	    "tags": ["tag:jail"],
	    "clientConnectivity": {
	      "endpoints": ["209.195.87.231:59128"],
	      "derp": "nyc",
	      "latency": {
	        "New York City": {"preferred": true, "latencyMs": 31.3}
	      }
	    }
	  }]
	}`)
	var payload adminDevices
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	n := adminDeviceToNode(payload.Devices[0])
	if n.ID != "nAbc" || !n.Jail || !n.Online {
		t.Fatalf("node=%+v", n)
	}
	if n.LatencyMS == nil || *n.LatencyMS < 31 || *n.LatencyMS > 32 {
		t.Fatalf("latency=%v", n.LatencyMS)
	}
}

func TestLocalStatusParse(t *testing.T) {
	raw := []byte(`{
	  "Version": "1.76.6",
	  "BackendState": "Running",
	  "Health": [],
	  "CurrentTailnet": {"Name": "plant.tailnet", "MagicDNSSuffix": "plant.ts.net", "MagicDNSEnabled": true},
	  "Self": {"ID": "n-self", "HostName": "edge-macbook", "DNSName": "edge-macbook.plant.ts.net.", "OS": "macOS", "TailscaleIPs": ["100.64.1.1"], "Online": true, "Active": true},
	  "Peer": {
	    "nodekey:abc": {
	      "ID": "n-exit",
	      "HostName": "exit-nyc",
	      "DNSName": "exit-nyc.plant.ts.net.",
	      "OS": "linux",
	      "TailscaleIPs": ["100.64.1.30"],
	      "Online": true,
	      "Active": true,
	      "Relay": "nyc",
	      "ExitNode": true,
	      "ExitNodeOption": true,
	      "AllowedIPs": ["0.0.0.0/0", "100.64.1.30/32"]
	    }
	  }
	}`)
	var st localStatus
	if err := json.Unmarshal(raw, &st); err != nil {
		t.Fatal(err)
	}
	self := localPeerToNode(*st.Self, true)
	if !self.Self || self.Hostname != "edge-macbook" {
		t.Fatalf("self=%+v", self)
	}
	peer := localPeerToNode(*st.Peer["nodekey:abc"], false)
	if !peer.Exit || peer.Role != "exit" {
		t.Fatalf("peer=%+v", peer)
	}
}

func TestFixtureJails(t *testing.T) {
	snap := (&Fixture{}).Collect(time.Date(2026, 8, 25, 13, 0, 0, 0, time.UTC))
	var jails, unauthorized int
	for _, n := range snap.Nodes {
		if n.Jail {
			jails++
		}
		if !n.Authorized {
			unauthorized++
		}
	}
	if jails < 3 {
		t.Fatalf("jails=%d", jails)
	}
	if unauthorized != 1 {
		t.Fatalf("unauthorized=%d", unauthorized)
	}
	if snap.Tailnet != "plant.tailnet" {
		t.Fatalf("tailnet=%s", snap.Tailnet)
	}
}

func TestParsePingMS(t *testing.T) {
	ms := parsePingMS("pong from exit-nyc (100.64.1.30) via DERP(nyc) in 32.1ms\n")
	if ms == nil || *ms < 32 || *ms > 33 {
		t.Fatalf("got %v", ms)
	}
}
