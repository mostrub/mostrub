package model

import (
	"strings"
	"time"
)

type Signal string

const (
	SignalClear    Signal = "clear"
	SignalAdvisory Signal = "advisory"
	SignalAlarm    Signal = "alarm"
)

type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

type AlertKind string

const (
	KindControlDown  AlertKind = "control_down"
	KindHealth       AlertKind = "health"
	KindNodeOffline  AlertKind = "node_offline"
	KindUnauthorized AlertKind = "unauthorized"
	KindNewNode      AlertKind = "new_node"
	KindKeyExpiry    AlertKind = "key_expiry"
	KindHighLatency  AlertKind = "high_latency"
	KindNodeFlap     AlertKind = "node_flap"
	KindUpdate       AlertKind = "update"
	KindReaderError  AlertKind = "reader_error"
)

type Role string

const (
	RoleSelf        Role = "self"
	RoleExit        Role = "exit"
	RoleSubnet      Role = "subnet"
	RoleJail        Role = "jail"
	RoleShared      Role = "shared"
	RoleWorkstation Role = "workstation"
)

type NodeState string

const (
	NodeOnline       NodeState = "online"
	NodeIdle         NodeState = "idle"
	NodeOffline      NodeState = "offline"
	NodeUnauthorized NodeState = "unauthorized"
	NodeExpired      NodeState = "expired"
	NodeUnknown      NodeState = "unknown"
)

type Source string

const (
	SourceAdmin   Source = "admin"
	SourceLocal   Source = "local"
	SourceMerged  Source = "merged"
	SourceFixture Source = "fixture"
)

type Node struct {
	ID              string     `json:"id"`
	NodeID          string     `json:"nodeId"`
	Hostname        string     `json:"hostname"`
	Name            string     `json:"name"`
	OS              string     `json:"os"`
	User            string     `json:"user"`
	ClientVersion   string     `json:"clientVersion"`
	Addresses       []string   `json:"addresses"`
	Tags            []string   `json:"tags"`
	Authorized      bool       `json:"authorized"`
	Online          bool       `json:"online"`
	Active          bool       `json:"active"`
	UpdateAvailable bool       `json:"updateAvailable"`
	KeyExpiryOff    bool       `json:"keyExpiryDisabled"`
	IsExternal      bool       `json:"isExternal"`
	IsEphemeral     bool       `json:"isEphemeral"`
	BlocksIncoming  bool       `json:"blocksIncoming"`
	Jail            bool       `json:"jail"`
	Exit            bool       `json:"exit"`
	ExitOption      bool       `json:"exitOption"`
	Subnet          bool       `json:"subnet"`
	Expired         bool       `json:"expired"`
	Role            Role       `json:"role"`
	State           NodeState  `json:"state"`
	Relay           string     `json:"relay"`
	CurAddr         string     `json:"curAddr"`
	LatencyMS       *float64   `json:"latencyMs"`
	RxBytes         int64      `json:"rxBytes"`
	TxBytes         int64      `json:"txBytes"`
	AdvertisedRoutes []string  `json:"advertisedRoutes"`
	EnabledRoutes   []string   `json:"enabledRoutes"`
	Endpoints       []string   `json:"endpoints"`
	DERP            string     `json:"derp"`
	LastSeen        *time.Time `json:"lastSeen"`
	LastHandshake   *time.Time `json:"lastHandshake"`
	Created         *time.Time `json:"created"`
	Expires         *time.Time `json:"expires"`
	Self            bool       `json:"self"`
}

type DERPLatency struct {
	Region     string  `json:"region"`
	LatencyMS  float64 `json:"latencyMs"`
	Preferred  bool    `json:"preferred"`
}

type Snapshot struct {
	CollectedAt  time.Time `json:"collectedAt"`
	Source       Source    `json:"source"`
	Tailnet      string    `json:"tailnet"`
	MagicDNS     string    `json:"magicDns"`
	MagicDNSOn   bool      `json:"magicDnsEnabled"`
	BackendState string    `json:"backendState"`
	Health       []string  `json:"health"`
	Nameservers  []string  `json:"nameservers"`
	SelfID       string    `json:"selfId"`
	Nodes        []Node    `json:"nodes"`
	ReaderError  string    `json:"readerError,omitempty"`
}

type Sample struct {
	TS        time.Time  `json:"ts"`
	NodeID    string     `json:"nodeId"`
	Online    bool       `json:"online"`
	LatencyMS *float64   `json:"latencyMs"`
	RxBytes   int64      `json:"rxBytes"`
	TxBytes   int64      `json:"txBytes"`
	Relay     string     `json:"relay"`
	State     NodeState  `json:"state"`
}

type Alert struct {
	ID          string     `json:"id"`
	Kind        AlertKind  `json:"kind"`
	Severity    Severity   `json:"severity"`
	NodeID      string     `json:"nodeId,omitempty"`
	Fingerprint string     `json:"fingerprint"`
	Title       string     `json:"title"`
	Detail      string     `json:"detail"`
	OpenedAt    time.Time  `json:"openedAt"`
	AckedAt     *time.Time `json:"ackedAt,omitempty"`
	ResolvedAt  *time.Time `json:"resolvedAt,omitempty"`
}

type Memo struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"createdAt"`
}

type Briefing struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type Event struct {
	TS     time.Time `json:"ts"`
	Kind   string    `json:"kind"`
	NodeID string    `json:"nodeId,omitempty"`
	Title  string    `json:"title"`
	Detail string    `json:"detail"`
}

type KPI struct {
	Online      int      `json:"online"`
	Total       int      `json:"total"`
	Jails       int      `json:"jails"`
	JailsDown   int      `json:"jailsDown"`
	Exits       int      `json:"exits"`
	ExitsDown   int      `json:"exitsDown"`
	Routers     int      `json:"routers"`
	RoutersDown int      `json:"routersDown"`
	LatencyP95  *float64 `json:"latencyP95"`
	KeysSoon    int      `json:"keysSoon"`
	Health      int      `json:"health"`
}

type Board struct {
	Signal   Signal    `json:"signal"`
	Snapshot Snapshot  `json:"snapshot"`
	KPI      KPI       `json:"kpi"`
	Alerts   []Alert   `json:"alerts"`
	Memos    []Memo    `json:"memos"`
	Briefing *Briefing `json:"briefing,omitempty"`
	Events   []Event   `json:"events"`
}

func IsJail(hostname, name, os string, tags []string) bool {
	if strings.EqualFold(os, "freebsd") {
		return true
	}
	blob := strings.ToLower(hostname + " " + name)
	if strings.Contains(blob, "jail") {
		return true
	}
	for _, t := range tags {
		lt := strings.ToLower(t)
		if lt == "tag:jail" || strings.Contains(lt, "jail") {
			return true
		}
	}
	return false
}

func Classify(n *Node) {
	n.Jail = IsJail(n.Hostname, n.Name, n.OS, n.Tags)
	n.Subnet = len(n.EnabledRoutes) > 0 || len(n.AdvertisedRoutes) > 0
	switch {
	case !n.Authorized:
		n.State = NodeUnauthorized
	case n.Expired:
		n.State = NodeExpired
	case n.Online && n.Active:
		n.State = NodeOnline
	case n.Online:
		n.State = NodeIdle
	case !n.Online:
		n.State = NodeOffline
	default:
		n.State = NodeUnknown
	}
	switch {
	case n.Self:
		n.Role = RoleSelf
	case n.Exit || n.ExitOption:
		n.Role = RoleExit
	case n.Subnet:
		n.Role = RoleSubnet
	case n.Jail:
		n.Role = RoleJail
	case n.IsExternal:
		n.Role = RoleShared
	default:
		n.Role = RoleWorkstation
	}
}

func SignalFrom(alerts []Alert) Signal {
	worst := SignalClear
	for _, a := range alerts {
		if a.ResolvedAt != nil {
			continue
		}
		switch a.Severity {
		case SeverityCritical:
			return SignalAlarm
		case SeverityWarning:
			worst = SignalAdvisory
		}
	}
	return worst
}

func ComputeKPI(nodes []Node, healthN int) KPI {
	k := KPI{Total: len(nodes), Health: healthN}
	var lats []float64
	now := time.Now()
	for _, n := range nodes {
		if n.Online {
			k.Online++
		}
		if n.Jail {
			k.Jails++
			if !n.Online {
				k.JailsDown++
			}
		}
		if n.Exit || n.ExitOption {
			k.Exits++
			if !n.Online {
				k.ExitsDown++
			}
		}
		if n.Subnet {
			k.Routers++
			if !n.Online {
				k.RoutersDown++
			}
		}
		if n.LatencyMS != nil {
			lats = append(lats, *n.LatencyMS)
		}
		if n.Expires != nil && !n.KeyExpiryOff && n.Expires.After(now) && n.Expires.Before(now.Add(7*24*time.Hour)) {
			k.KeysSoon++
		}
	}
	if p := percentile(lats, 0.95); p != nil {
		k.LatencyP95 = p
	}
	return k
}

func percentile(values []float64, p float64) *float64 {
	if len(values) == 0 {
		return nil
	}
	cp := append([]float64(nil), values...)
	for i := 1; i < len(cp); i++ {
		for j := i; j > 0 && cp[j] < cp[j-1]; j-- {
			cp[j], cp[j-1] = cp[j-1], cp[j]
		}
	}
	idx := int(float64(len(cp)-1) * p)
	v := cp[idx]
	return &v
}

func DisplayName(n Node) string {
	if n.Hostname != "" {
		return n.Hostname
	}
	if n.Name != "" {
		return n.Name
	}
	return n.ID
}
