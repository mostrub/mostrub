package brief

import (
	"strings"
	"testing"

	"github.com/mostrub/mostrub/tailboard/internal/model"
)

func TestRulesNamesJail(t *testing.T) {
	text := Rules(model.Board{
		Signal: model.SignalAlarm,
		Snapshot: model.Snapshot{Tailnet: "plant.tailnet", Source: model.SourceFixture},
		KPI: model.KPI{Online: 12, Total: 15, JailsDown: 1},
		Alerts: []model.Alert{{
			Kind: model.KindNodeOffline, Severity: model.SeverityCritical,
			Title: "jail-plc-03 jail is offline",
		}},
	})
	if !strings.Contains(text, "ALARM") || !strings.Contains(text, "jail") {
		t.Fatalf("brief=%q", text)
	}
}
