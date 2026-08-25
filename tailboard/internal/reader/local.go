package reader

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

type Local struct {
	Bin  string
	Ping bool
}

func (l *Local) bin() string {
	if l.Bin == "" {
		return "tailscale"
	}
	return l.Bin
}

func (l *Local) Collect(ctx context.Context) (model.Snapshot, error) {
	snap := model.Snapshot{
		CollectedAt: time.Now().UTC(),
		Source:      model.SourceLocal,
	}
	out, err := l.run(ctx, "status", "--json")
	if err != nil {
		return snap, err
	}
	var st localStatus
	if err := json.Unmarshal(out, &st); err != nil {
		return snap, fmt.Errorf("local status: %w", err)
	}
	snap.BackendState = st.BackendState
	snap.Health = st.Health
	snap.MagicDNS = st.MagicDNSSuffix
	if st.CurrentTailnet != nil {
		snap.Tailnet = st.CurrentTailnet.Name
		snap.MagicDNS = st.CurrentTailnet.MagicDNSSuffix
		snap.MagicDNSOn = st.CurrentTailnet.MagicDNSEnabled
	}
	if st.Self != nil {
		self := localPeerToNode(*st.Self, true)
		snap.SelfID = self.ID
		snap.Nodes = append(snap.Nodes, self)
	}
	for _, p := range st.Peer {
		if p == nil {
			continue
		}
		snap.Nodes = append(snap.Nodes, localPeerToNode(*p, false))
	}
	if l.Ping {
		l.samplePing(ctx, &snap)
	}
	return snap, nil
}

func (l *Local) run(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, l.bin(), args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w: %s", l.bin(), strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return out, nil
}

func (l *Local) samplePing(ctx context.Context, snap *model.Snapshot) {
	n := 0
	for i := range snap.Nodes {
		node := &snap.Nodes[i]
		if node.Self || !node.Online || len(node.Addresses) == 0 {
			continue
		}
		if n >= 6 {
			break
		}
		n++
		pctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		out, err := l.run(pctx, "ping", "--c", "1", "--timeout", "2s", node.Addresses[0])
		cancel()
		if err != nil {
			continue
		}
		if ms := parsePingMS(string(out)); ms != nil {
			node.LatencyMS = ms
		}
	}
}

func parsePingMS(out string) *float64 {
	// tailscale ping: "pong from host (100.x.x.x) via DERP(nyc) in 32.1ms"
	low := strings.ToLower(out)
	i := strings.LastIndex(low, " in ")
	if i < 0 {
		return nil
	}
	rest := strings.TrimSpace(out[i+4:])
	rest = strings.TrimSuffix(rest, "\n")
	rest = strings.TrimSuffix(rest, "s")
	if strings.HasSuffix(rest, "m") {
		rest = strings.TrimSuffix(rest, "m")
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(rest), 64)
	if err != nil {
		return nil
	}
	return &v
}

type localStatus struct {
	Version        string
	BackendState   string
	Health         []string
	MagicDNSSuffix string
	CurrentTailnet *struct {
		Name            string
		MagicDNSSuffix  string
		MagicDNSEnabled bool
	}
	Self *localPeer
	Peer map[string]*localPeer
}

type localPeer struct {
	ID             string
	HostName       string
	DNSName        string
	OS             string
	UserID         int64
	TailscaleIPs   []string
	Tags           []string
	Online         bool
	Active         bool
	Relay          string
	CurAddr        string
	RxBytes        int64
	TxBytes        int64
	LastSeen       time.Time
	LastHandshake  time.Time
	Created        time.Time
	ExitNode       bool
	ExitNodeOption bool
	Expired        bool
	KeyExpiry      *time.Time
	ShareeNode     bool
	AllowedIPs     []string
}

func localPeerToNode(p localPeer, self bool) model.Node {
	n := model.Node{
		ID:         firstNonEmpty(p.ID, p.HostName),
		Hostname:   p.HostName,
		Name:       strings.TrimSuffix(p.DNSName, "."),
		OS:         p.OS,
		Addresses:  stringifyIPs(p.TailscaleIPs),
		Tags:       p.Tags,
		Authorized: true,
		Online:     p.Online,
		Active:     p.Active,
		Expired:    p.Expired,
		Exit:       p.ExitNode,
		ExitOption: p.ExitNodeOption,
		IsExternal: p.ShareeNode,
		Relay:      p.Relay,
		CurAddr:    p.CurAddr,
		RxBytes:    p.RxBytes,
		TxBytes:    p.TxBytes,
		Self:       self,
	}
	if !p.LastSeen.IsZero() {
		t := p.LastSeen.UTC()
		n.LastSeen = &t
	}
	if !p.LastHandshake.IsZero() {
		t := p.LastHandshake.UTC()
		n.LastHandshake = &t
	}
	if !p.Created.IsZero() {
		t := p.Created.UTC()
		n.Created = &t
	}
	if p.KeyExpiry != nil && !p.KeyExpiry.IsZero() {
		t := p.KeyExpiry.UTC()
		n.Expires = &t
	}
	for _, r := range p.AllowedIPs {
		if !isSingleTailscaleIP(r, n.Addresses) {
			n.EnabledRoutes = append(n.EnabledRoutes, r)
		}
	}
	model.Classify(&n)
	return n
}

func stringifyIPs(in []string) []string {
	return append([]string(nil), in...)
}

func isSingleTailscaleIP(route string, addrs []string) bool {
	ip := strings.TrimSuffix(route, "/32")
	ip = strings.TrimSuffix(ip, "/128")
	for _, a := range addrs {
		if a == ip || a == route {
			return true
		}
	}
	return strings.HasSuffix(route, "/32") || strings.HasSuffix(route, "/128")
}
