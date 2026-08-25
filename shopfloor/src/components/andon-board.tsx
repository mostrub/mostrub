import type { KeyboardEvent } from "react"

import { formatNumber, formatPct } from "@/lib/format"
import { andonFill, andonTone } from "@/lib/shopfloor-charts"
import type { QueryRow } from "@/lib/duckdb/engine"

export function AndonBoard(args: {
  rows: QueryRow[]
  onPick: (line: string) => void
}) {
  if (args.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Keine Linien in diesem Filter.</p>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {args.rows.map((row) => {
        const line = String(row.line ?? "")
        const fpy = Number(row.fpy_pct ?? 0)
        const avg = Number(row.avg_cycle_ms ?? 0)
        const target = Number(row.target_cycle_ms ?? 0)
        const tone = andonTone({
          fpyPct: fpy,
          avgCycleMs: avg,
          targetCycleMs: target,
        })
        const fill = andonFill(tone)
        const toneLabel =
          tone === "ok" ? "läuft" : tone === "warn" ? "Grenzbereich" : "eingeklemmt"
        return (
          <div
            key={`${row.plant}-${line}`}
            role="button"
            tabIndex={0}
            className="rounded-xl border px-3 py-2.5 text-left"
            style={{
              borderLeftWidth: 6,
              borderLeftColor: fill,
              backgroundColor: `color-mix(in oklch, ${fill} 14%, transparent)`,
            }}
            onClick={() => args.onPick(line)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                args.onPick(line)
              }
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{line}</p>
              <p className="text-xs text-muted-foreground">{toneLabel}</p>
            </div>
            <p className="font-mono text-lg">{formatPct(fpy)}</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(Number(row.good_units ?? 0))} Gut · Takt{" "}
              {formatNumber(avg / 1000, 1)} s / Soll {formatNumber(target / 1000, 1)} s
            </p>
          </div>
        )
      })}
    </div>
  )
}
