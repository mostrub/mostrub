package reader

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

type Admin struct {
	BaseURL     string
	APIKey      string
	ClientID    string
	ClientSec   string
	Tailnet     string
	HTTP        *http.Client
	MinInterval time.Duration
	token       string
	tokenExp    time.Time
	lastAt      time.Time
	lastSnap    model.Snapshot
	lastErr     error
}

func (a *Admin) Enabled() bool {
	return a.APIKey != "" || (a.ClientID != "" && a.ClientSec != "")
}

func (a *Admin) Collect(ctx context.Context) (model.Snapshot, error) {
	interval := a.MinInterval
	if interval <= 0 {
		interval = 60 * time.Second
	}
	if !a.lastAt.IsZero() && time.Since(a.lastAt) < interval && a.lastErr == nil {
		cached := a.lastSnap
		cached.CollectedAt = time.Now().UTC()
		return cached, nil
	}
	snap, err := a.collectNow(ctx)
	a.lastAt = time.Now().UTC()
	a.lastSnap = snap
	a.lastErr = err
	return snap, err
}

func (a *Admin) collectNow(ctx context.Context) (model.Snapshot, error) {
	snap := model.Snapshot{
		CollectedAt: time.Now().UTC(),
		Source:      model.SourceAdmin,
		Tailnet:     a.tailnet(),
	}
	body, err := a.get(ctx, "/tailnet/"+url.PathEscape(a.tailnet())+"/devices?fields=all")
	if err != nil {
		return snap, err
	}
	var payload adminDevices
	if err := json.Unmarshal(body, &payload); err != nil {
		return snap, fmt.Errorf("admin devices: %w", err)
	}
	for _, d := range payload.Devices {
		snap.Nodes = append(snap.Nodes, adminDeviceToNode(d))
	}
	if ns, err := a.get(ctx, "/tailnet/"+url.PathEscape(a.tailnet())+"/dns/nameservers"); err == nil {
		var dns adminDNS
		if json.Unmarshal(ns, &dns) == nil {
			snap.Nameservers = dns.DNS
		}
	}
	if pref, err := a.get(ctx, "/tailnet/"+url.PathEscape(a.tailnet())+"/dns/preferences"); err == nil {
		var p adminPref
		if json.Unmarshal(pref, &p) == nil {
			snap.MagicDNSOn = p.MagicDNS
		}
	}
	return snap, nil
}

func (a *Admin) tailnet() string {
	if a.Tailnet == "" {
		return "-"
	}
	return a.Tailnet
}

func (a *Admin) base() string {
	if a.BaseURL == "" {
		return "https://api.tailscale.com/api/v2"
	}
	return strings.TrimRight(a.BaseURL, "/")
}

func (a *Admin) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.base()+path, nil)
	if err != nil {
		return nil, err
	}
	if err := a.authorize(ctx, req); err != nil {
		return nil, err
	}
	client := a.HTTP
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("admin %s: %s: %s", path, res.Status, strings.TrimSpace(string(b)))
	}
	return b, nil
}

func (a *Admin) authorize(ctx context.Context, req *http.Request) error {
	if a.APIKey != "" {
		req.SetBasicAuth(a.APIKey, "")
		return nil
	}
	tok, err := a.oauthToken(ctx)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	return nil
}

func (a *Admin) oauthToken(ctx context.Context) (string, error) {
	if a.token != "" && time.Now().Before(a.tokenExp.Add(-30*time.Second)) {
		return a.token, nil
	}
	form := url.Values{}
	form.Set("client_id", a.ClientID)
	form.Set("client_secret", a.ClientSec)
	form.Set("grant_type", "client_credentials")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.base()+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := a.HTTP
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("oauth token: %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(b, &tok); err != nil {
		return "", err
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("oauth token: empty access_token")
	}
	exp := 3600
	if tok.ExpiresIn > 0 {
		exp = tok.ExpiresIn
	}
	a.token = tok.AccessToken
	a.tokenExp = time.Now().Add(time.Duration(exp) * time.Second)
	return a.token, nil
}

type adminDevices struct {
	Devices []adminDevice `json:"devices"`
}

type adminDevice struct {
	Addresses                []string           `json:"addresses"`
	ID                       string             `json:"id"`
	NodeID                   string             `json:"nodeId"`
	User                     string             `json:"user"`
	Name                     string             `json:"name"`
	Hostname                 string             `json:"hostname"`
	ClientVersion            string             `json:"clientVersion"`
	UpdateAvailable          bool               `json:"updateAvailable"`
	OS                       string             `json:"os"`
	Created                  time.Time          `json:"created"`
	LastSeen                 *time.Time         `json:"lastSeen"`
	KeyExpiryDisabled        bool               `json:"keyExpiryDisabled"`
	Expires                  time.Time          `json:"expires"`
	Authorized               bool               `json:"authorized"`
	IsExternal               bool               `json:"isExternal"`
	IsEphemeral              bool               `json:"isEphemeral"`
	BlocksIncomingConnections bool              `json:"blocksIncomingConnections"`
	ConnectedToControl       bool               `json:"connectedToControl"`
	EnabledRoutes            []string           `json:"enabledRoutes"`
	AdvertisedRoutes         []string           `json:"advertisedRoutes"`
	Tags                     []string           `json:"tags"`
	ClientConnectivity       *adminConnectivity `json:"clientConnectivity"`
}

type adminConnectivity struct {
	Endpoints             []string                    `json:"endpoints"`
	DERP                  string                      `json:"derp"`
	MappingVariesByDestIP bool                        `json:"mappingVariesByDestIP"`
	Latency               map[string]adminDERPLatency `json:"latency"`
}

type adminDERPLatency struct {
	LatencyMS float64 `json:"latencyMs"`
	Preferred bool    `json:"preferred"`
}

type adminDNS struct {
	DNS []string `json:"dns"`
}

type adminPref struct {
	MagicDNS bool `json:"magicDNS"`
}

func adminDeviceToNode(d adminDevice) model.Node {
	n := model.Node{
		ID:               firstNonEmpty(d.NodeID, d.ID),
		NodeID:           d.NodeID,
		Hostname:         d.Hostname,
		Name:             d.Name,
		OS:               d.OS,
		User:             d.User,
		ClientVersion:    d.ClientVersion,
		Addresses:        d.Addresses,
		Tags:             d.Tags,
		Authorized:       d.Authorized,
		Online:           d.ConnectedToControl,
		Active:           d.ConnectedToControl,
		UpdateAvailable:  d.UpdateAvailable,
		KeyExpiryOff:     d.KeyExpiryDisabled,
		IsExternal:       d.IsExternal,
		IsEphemeral:      d.IsEphemeral,
		BlocksIncoming:   d.BlocksIncomingConnections,
		AdvertisedRoutes: d.AdvertisedRoutes,
		EnabledRoutes:    d.EnabledRoutes,
		LastSeen:         d.LastSeen,
	}
	if !d.Created.IsZero() {
		t := d.Created.UTC()
		n.Created = &t
	}
	if !d.Expires.IsZero() {
		t := d.Expires.UTC()
		n.Expires = &t
	}
	if d.ClientConnectivity != nil {
		n.Endpoints = d.ClientConnectivity.Endpoints
		n.DERP = d.ClientConnectivity.DERP
		n.Relay = d.ClientConnectivity.DERP
		if lat := preferredLatency(d.ClientConnectivity.Latency); lat != nil {
			n.LatencyMS = lat
		}
	}
	model.Classify(&n)
	return n
}

func preferredLatency(m map[string]adminDERPLatency) *float64 {
	if len(m) == 0 {
		return nil
	}
	for _, v := range m {
		if v.Preferred {
			x := v.LatencyMS
			return &x
		}
	}
	var best *float64
	for _, v := range m {
		x := v.LatencyMS
		if best == nil || x < *best {
			best = &x
		}
	}
	return best
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}
