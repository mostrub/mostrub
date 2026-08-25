package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/alert"
	"github.com/mostrub/mostrub/tailboard/internal/brief"
	"github.com/mostrub/mostrub/tailboard/internal/model"
	"github.com/mostrub/mostrub/tailboard/internal/reader"
	"github.com/mostrub/mostrub/tailboard/internal/store"
)

type Config struct {
	Listen      string
	Poll        time.Duration
	Webhook     string
	UI          fs.FS
	Now         func() time.Time
}

type Server struct {
	cfg     Config
	store   *store.Store
	collect *reader.Collector
	engine  *alert.Engine
	brief   *brief.Writer
	http    *http.Client

	mu   sync.RWMutex
	subs map[chan []byte]struct{}
}

func New(st *store.Store, col *reader.Collector, eng *alert.Engine, br *brief.Writer, cfg Config) *Server {
	if cfg.Poll <= 0 {
		cfg.Poll = 15 * time.Second
	}
	if cfg.Now == nil {
		cfg.Now = func() time.Time { return time.Now().UTC() }
	}
	return &Server{
		cfg:     cfg,
		store:   st,
		collect: col,
		engine:  eng,
		brief:   br,
		http:    &http.Client{Timeout: 5 * time.Second},
		subs:    map[chan []byte]struct{}{},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/favicon.ico", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/board", s.handleBoard)
	mux.HandleFunc("/api/nodes/", s.handleNode)
	mux.HandleFunc("/api/alerts", s.handleAlerts)
	mux.HandleFunc("/api/alerts/", s.handleAlertAck)
	mux.HandleFunc("/api/memos", s.handleMemos)
	mux.HandleFunc("/api/memos/", s.handleMemoPin)
	mux.HandleFunc("/api/briefing", s.handleBriefGet)
	mux.HandleFunc("/api/briefing/refresh", s.handleBriefRefresh)
	mux.HandleFunc("/api/stream", s.handleStream)
	if s.cfg.UI != nil {
		file := http.FileServer(http.FS(s.cfg.UI))
		mux.Handle("/", spa(file))
	}
	return mux
}

func spa(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) Run(ctx context.Context) error {
	s.poll(ctx)
	t := time.NewTicker(s.cfg.Poll)
	defer t.Stop()
	briefTick := time.NewTicker(5 * time.Minute)
	defer briefTick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
			s.poll(ctx)
		case <-briefTick.C:
			s.refreshBrief(ctx)
		}
	}
}

func (s *Server) poll(ctx context.Context) {
	snap, err := s.collect.Collect(ctx)
	if err != nil {
		last, _ := s.store.LatestSnapshot()
		snap = reader.RecoverLiveOrFixture(err, last, s.cfg.Now(), s.collect.Fixture)
	}
	res, err := s.engine.Evaluate(snap)
	if err != nil {
		log.Printf("alert evaluate: %v", err)
	}
	if err := s.store.RecordSnapshot(snap); err != nil {
		log.Printf("record snapshot: %v", err)
	}
	for _, a := range res.Opened {
		s.postWebhook(a, snap)
	}
	if last, _ := s.store.LatestBriefing(); last == nil {
		s.refreshBrief(ctx)
	}
	s.broadcast()
}

func (s *Server) refreshBrief(ctx context.Context) {
	board, err := s.board()
	if err != nil {
		return
	}
	if _, err := s.brief.Refresh(ctx, board); err != nil {
		log.Printf("briefing: %v", err)
	}
	s.broadcast()
}

func (s *Server) board() (model.Board, error) {
	snap, err := s.store.LatestSnapshot()
	if err != nil {
		return model.Board{}, err
	}
	if snap == nil {
		empty := model.Snapshot{CollectedAt: s.cfg.Now(), Source: model.SourceFixture, Tailnet: "waiting"}
		return model.Board{Signal: model.SignalClear, Snapshot: empty}, nil
	}
	alerts, err := s.store.OpenAlerts()
	if err != nil {
		return model.Board{}, err
	}
	memos, err := s.store.Memos()
	if err != nil {
		return model.Board{}, err
	}
	events, err := s.store.RecentEvents(50)
	if err != nil {
		return model.Board{}, err
	}
	br, err := s.store.LatestBriefing()
	if err != nil {
		return model.Board{}, err
	}
	sparks, err := s.store.RecentSamples(s.cfg.Now().Add(-20 * time.Minute))
	if err != nil {
		return model.Board{}, err
	}
	return model.Board{
		Signal:     model.SignalFrom(alerts),
		Snapshot:   *snap,
		KPI:        model.ComputeKPI(snap.Nodes, len(snap.Health)),
		Alerts:     alerts,
		Memos:      memos,
		Briefing:   br,
		Events:     events,
		Sparklines: sparks,
	}, nil
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleBoard(w http.ResponseWriter, _ *http.Request) {
	b, err := s.board()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) handleNode(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/nodes/")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	snap, err := s.store.LatestSnapshot()
	if err != nil || snap == nil {
		http.NotFound(w, r)
		return
	}
	var node *model.Node
	for i := range snap.Nodes {
		if snap.Nodes[i].ID == id {
			node = &snap.Nodes[i]
			break
		}
	}
	if node == nil {
		http.NotFound(w, r)
		return
	}
	hist, err := s.store.History(id, time.Now().Add(-6*time.Hour))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"node": node, "history": hist})
}

func (s *Server) handleAlerts(w http.ResponseWriter, _ *http.Request) {
	alerts, err := s.store.OpenAlerts()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, http.StatusOK, alerts)
}

func (s *Server) handleAlertAck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/alerts/")
	id, _, _ := strings.Cut(rest, "/")
	if !strings.HasSuffix(r.URL.Path, "/ack") || id == "" {
		http.NotFound(w, r)
		return
	}
	if err := s.store.AckAlert(id, time.Now().UTC()); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	s.broadcast()
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "acked": "true"})
}

func (s *Server) handleMemos(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		memos, err := s.store.Memos()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		writeJSON(w, http.StatusOK, memos)
	case http.MethodPost:
		var in struct {
			Author string `json:"author"`
			Body   string `json:"body"`
			Pinned bool   `json:"pinned"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&in); err != nil {
			http.Error(w, "bad json", 400)
			return
		}
		if strings.TrimSpace(in.Body) == "" {
			http.Error(w, "body required", 400)
			return
		}
		if in.Author == "" {
			in.Author = "operator"
		}
		m := model.Memo{ID: store.NewID("me"), Author: in.Author, Body: strings.TrimSpace(in.Body), Pinned: in.Pinned, CreatedAt: time.Now().UTC()}
		if err := s.store.InsertMemo(m); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		s.broadcast()
		writeJSON(w, http.StatusCreated, m)
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleMemoPin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/memos/")
	id, action, _ := strings.Cut(rest, "/")
	if id == "" || action != "pin" {
		http.NotFound(w, r)
		return
	}
	var in struct {
		Pinned bool `json:"pinned"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&in); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	if err := s.store.SetMemoPin(id, in.Pinned); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	s.broadcast()
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "pinned": in.Pinned})
}

func (s *Server) handleBriefGet(w http.ResponseWriter, _ *http.Request) {
	b, err := s.store.LatestBriefing()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) handleBriefRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	s.refreshBrief(r.Context())
	b, err := s.store.LatestBriefing()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", 500)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	ch := make(chan []byte, 4)
	s.mu.Lock()
	s.subs[ch] = struct{}{}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.subs, ch)
		s.mu.Unlock()
	}()
	if b, err := s.board(); err == nil {
		if raw, err := json.Marshal(b); err == nil {
			_, _ = w.Write([]byte("event: board\ndata: "))
			_, _ = w.Write(raw)
			_, _ = w.Write([]byte("\n\n"))
			fl.Flush()
		}
	}
	for {
		select {
		case <-r.Context().Done():
			return
		case raw := <-ch:
			_, _ = w.Write([]byte("event: board\ndata: "))
			_, _ = w.Write(raw)
			_, _ = w.Write([]byte("\n\n"))
			fl.Flush()
		}
	}
}

func (s *Server) broadcast() {
	b, err := s.board()
	if err != nil {
		return
	}
	raw, err := json.Marshal(b)
	if err != nil {
		return
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for ch := range s.subs {
		select {
		case ch <- raw:
		default:
		}
	}
}

func (s *Server) postWebhook(a model.Alert, snap model.Snapshot) {
	if s.cfg.Webhook == "" {
		return
	}
	var node *model.Node
	for i := range snap.Nodes {
		if snap.Nodes[i].ID == a.NodeID {
			n := snap.Nodes[i]
			node = &n
			break
		}
	}
	body, err := json.Marshal(map[string]any{
		"alert":   a,
		"node":    node,
		"signal":  model.SignalFrom([]model.Alert{a}),
		"tailnet": snap.Tailnet,
	})
	if err != nil {
		return
	}
	req, err := http.NewRequest(http.MethodPost, s.cfg.Webhook, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := s.http.Do(req)
	if err != nil {
		log.Printf("webhook: %v", err)
		return
	}
	_ = res.Body.Close()
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
