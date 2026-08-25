package brief

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/model"
	"github.com/mostrub/mostrub/tailboard/internal/store"
)

type Writer struct {
	URL   string
	Key   string
	Model string
	HTTP  *http.Client
	Store *store.Store
}

func (w *Writer) Refresh(ctx context.Context, board model.Board) (model.Briefing, error) {
	body := Rules(board)
	src := "rules"
	if w.URL != "" && w.Key != "" {
		if ai, err := w.ask(ctx, board); err == nil && strings.TrimSpace(ai) != "" {
			body = ai
			src = "model"
		}
	}
	b := model.Briefing{
		ID:        store.NewID("br"),
		Source:    src,
		Body:      body,
		CreatedAt: time.Now().UTC(),
	}
	if err := w.Store.InsertBriefing(b); err != nil {
		return b, err
	}
	return b, nil
}

func Rules(board model.Board) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Signal is %s on %s via %s reader.", strings.ToUpper(string(board.Signal)), board.Snapshot.Tailnet, board.Snapshot.Source)
	fmt.Fprintf(&b, " %d of %d nodes online.", board.KPI.Online, board.KPI.Total)
	if board.KPI.JailsDown > 0 {
		fmt.Fprintf(&b, " %d jail(s) dark.", board.KPI.JailsDown)
	}
	if board.KPI.ExitsDown > 0 {
		fmt.Fprintf(&b, " Exit path down.")
	}
	if board.KPI.RoutersDown > 0 {
		fmt.Fprintf(&b, " Subnet router down.")
	}
	open := 0
	for _, a := range board.Alerts {
		if a.ResolvedAt == nil {
			open++
		}
	}
	if open == 0 {
		b.WriteString(" No open alerts. Walk the jail row and the exit lamp on the next pass.")
	} else {
		fmt.Fprintf(&b, " %d open alert(s):", open)
		n := 0
		for _, a := range board.Alerts {
			if a.ResolvedAt != nil {
				continue
			}
			n++
			if n > 5 {
				break
			}
			fmt.Fprintf(&b, " [%s] %s.", strings.ToUpper(string(a.Severity)), a.Title)
		}
	}
	if len(board.Memos) > 0 {
		fmt.Fprintf(&b, " Latest memo from %s: %s", board.Memos[0].Author, trim(board.Memos[0].Body, 140))
	}
	return strings.TrimSpace(b.String())
}

func (w *Writer) ask(ctx context.Context, board model.Board) (string, error) {
	facts := map[string]any{
		"signal":  board.Signal,
		"tailnet": board.Snapshot.Tailnet,
		"source":  board.Snapshot.Source,
		"kpi":     board.KPI,
		"alerts":  board.Alerts,
		"health":  board.Snapshot.Health,
	}
	raw, err := json.Marshal(facts)
	if err != nil {
		return "", err
	}
	modelName := w.Model
	if modelName == "" {
		modelName = "gpt-4o-mini"
	}
	payload := map[string]any{
		"model": modelName,
		"messages": []map[string]string{
			{"role": "system", "content": "You are the AI desk on an industrial Tailscale wall board. Write 4-6 short sentences for an operator standing 3 meters from a TV. Name offline jails, exits, and routers first. No markdown. No cheer."},
			{"role": "user", "content": string(raw)},
		},
		"temperature": 0.2,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(w.URL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+w.Key)
	req.Header.Set("Content-Type", "application/json")
	client := w.HTTP
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
		return "", fmt.Errorf("ai %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("ai: empty choices")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func trim(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
