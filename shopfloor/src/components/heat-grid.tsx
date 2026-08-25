import { formatNumber, formatPct } from "@/lib/format"
import { buildHeatGrid, heatFill, type HeatCell } from "@/lib/shopfloor-charts"

export function HeatGrid(args: {
  rows: HeatCell[]
  onPickLine: (line: string) => void
}) {
  const grid = buildHeatGrid(args.rows)
  if (grid.lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Keine Stundenwerte in diesem Filter.</p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="px-1 text-left font-medium text-muted-foreground">Linie</th>
            {grid.hours.map((hour) => (
              <th key={hour} className="min-w-10 px-1 text-center font-medium text-muted-foreground">
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.lines.map((line) => (
            <tr key={line}>
              <th className="px-1 text-left font-medium">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => args.onPickLine(line)}
                >
                  {line}
                </button>
              </th>
              {grid.hours.map((hour) => {
                const cell = grid.cell(line, hour)
                if (!cell) {
                  return (
                    <td
                      key={hour}
                      className="h-9 rounded-md bg-muted/50"
                      title={`${line} ${hour}:00 — keine Takte`}
                    />
                  )
                }
                const fill = heatFill(cell.fpy_pct)
                return (
                  <td key={hour}>
                    <button
                      type="button"
                      className={`flex h-9 w-full flex-col items-center justify-center rounded-md text-[10px] font-medium ${
                        cell.fpy_pct >= 90 ? "text-foreground" : "text-background"
                      }`}
                      style={{
                        backgroundColor: fill,
                      }}
                      title={`${line} ${hour}:00 · ${formatPct(cell.fpy_pct)} · ${formatNumber(cell.cycles)} Takte`}
                      onClick={() => args.onPickLine(line)}
                    >
                      <span>{formatNumber(cell.fpy_pct, 0)}</span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
