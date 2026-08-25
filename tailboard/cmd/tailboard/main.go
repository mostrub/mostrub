package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mostrub/mostrub/tailboard/internal/alert"
	"github.com/mostrub/mostrub/tailboard/internal/brief"
	"github.com/mostrub/mostrub/tailboard/internal/model"
	"github.com/mostrub/mostrub/tailboard/internal/reader"
	"github.com/mostrub/mostrub/tailboard/internal/server"
	"github.com/mostrub/mostrub/tailboard/internal/store"
	"github.com/mostrub/mostrub/tailboard/internal/ui"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("tailboard ")
	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}

func run(args []string) error {
	cmd := "serve"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd = args[0]
		args = args[1:]
	}

	fs := flag.NewFlagSet("tailboard", flag.ContinueOnError)
	listen := fs.String("listen", env("TAILBOARD_LISTEN", ":4747"), "http listen address")
	data := fs.String("data", env("TAILBOARD_DATA", "tailboard.db"), "sqlite path")
	mode := fs.String("mode", env("TAILBOARD_MODE", "auto"), "auto|admin|local|fixture")
	apiKey := fs.String("api-key", os.Getenv("TAILSCALE_API_KEY"), "Tailscale API key (tskey-api-...)")
	tailnet := fs.String("tailnet", env("TAILSCALE_TAILNET", "-"), "tailnet name or -")
	oauthID := fs.String("oauth-client-id", os.Getenv("TAILSCALE_OAUTH_CLIENT_ID"), "OAuth client id")
	oauthSec := fs.String("oauth-client-secret", os.Getenv("TAILSCALE_OAUTH_CLIENT_SECRET"), "OAuth client secret")
	bin := fs.String("tailscale", env("TAILSCALE_BIN", "tailscale"), "tailscale CLI path")
	ping := fs.Bool("ping", env("TAILBOARD_PING", "") == "1", "sample tailscale ping on local peers")
	poll := fs.Duration("poll", parseDur(env("TAILBOARD_POLL", "15s"), 15*time.Second), "poll interval")
	webhook := fs.String("webhook", os.Getenv("TAILBOARD_WEBHOOK"), "alert webhook URL")
	aiURL := fs.String("ai-url", env("TAILBOARD_AI_URL", "https://api.openai.com/v1"), "OpenAI-compatible base URL")
	aiKey := fs.String("ai-key", os.Getenv("TAILBOARD_AI_KEY"), "AI API key")
	aiModel := fs.String("ai-model", env("TAILBOARD_AI_MODEL", "gpt-4o-mini"), "AI model")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if cmd == "demo" {
		*mode = "fixture"
	}

	st, err := store.Open(*data)
	if err != nil {
		return err
	}
	defer st.Close()
	if err := seedMemo(st); err != nil {
		return err
	}

	col := &reader.Collector{
		Mode:    reader.Mode(*mode),
		Admin:   &reader.Admin{APIKey: *apiKey, ClientID: *oauthID, ClientSec: *oauthSec, Tailnet: *tailnet},
		Local:   &reader.Local{Bin: *bin, Ping: *ping},
		Fixture: &reader.Fixture{},
	}
	eng := &alert.Engine{Store: st}
	br := &brief.Writer{URL: *aiURL, Key: *aiKey, Model: *aiModel, Store: st}
	uiFS, err := ui.FS()
	if err != nil {
		return err
	}
	srv := server.New(st, col, eng, br, server.Config{
		Listen:  *listen,
		Poll:    *poll,
		Webhook: *webhook,
		UI:      uiFS,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		if err := srv.Run(ctx); err != nil && err != context.Canceled {
			log.Printf("poller: %v", err)
		}
	}()

	httpSrv := &http.Server{Addr: *listen, Handler: srv.Handler()}
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(c)
	}()
	log.Printf("board on http://127.0.0.1%s  mode=%s  data=%s", *listen, *mode, *data)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func seedMemo(st *store.Store) error {
	memos, err := st.Memos()
	if err != nil || len(memos) > 0 {
		return err
	}
	return st.InsertMemo(model.Memo{
		ID:        store.NewID("me"),
		Author:    "tailboard",
		Body:      "Board is live. Pin shift notes here. Acknowledging an alert silences the lamp, it does not stop the collector.",
		Pinned:    true,
		CreatedAt: time.Now().UTC(),
	})
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

func parseDur(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
