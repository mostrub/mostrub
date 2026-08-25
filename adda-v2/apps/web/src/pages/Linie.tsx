import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type LineBoard } from "../lib/api.ts";
import { formatCount, formatPercent, formatWhen } from "../lib/format.ts";
import { EmptyNote, Hud, Pill } from "../ui.tsx";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function LiniePage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<LineBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .linie()
        .then((next) => {
          if (cancelled) return;
          setBoard(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : de.lakeDown);
        });
    };
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const peakHour = board?.hours.reduce((max, row) => Math.max(max, row.inspected), 0) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm tracking-[0.28em] text-amber uppercase">HLL-2</p>
          <h1 className="font-display text-6xl leading-none">LINIE</h1>
        </div>
        {board ? (
          <div className="flex flex-wrap gap-2">
            <Hud label="Teile" value={formatCount(board.inspected)} />
            <Hud label="Ausbeute" value={formatPercent(board.yield)} warn={(board.yield ?? 1) < 0.8} />
            <Hud label="NIO" value={formatCount(board.nio)} warn={board.nio > 0} />
            <Hud
              label="Takt/h"
              value={board.taktPerHour === null ? "—" : formatCount(Math.round(board.taktPerHour))}
            />
            <Hud
              label="Span Ø"
              value={board.spanMean === null ? "—" : `${board.spanMean.toFixed(3)}`}
              warn={(board.spanMean ?? 0) > 0.12}
            />
            <Hud label="Snap" value={String(board.snapshotId)} />
          </div>
        ) : null}
      </header>

      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {board && board.inspected === 0 ? <EmptyNote>{de.empty.linie}</EmptyNote> : null}

      {board ? (
        <section className="border border-line bg-panel p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-2xl tracking-wide">{de.takt}</h2>
            <p className="text-xs text-mist">Europe/Zurich · 00–23</p>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {HOURS.map((hour) => {
              const row = board.hours.find((item) => item.hour === hour);
              const inspected = row?.inspected ?? 0;
              const nio = row?.nio ?? 0;
              const height = peakHour === 0 ? 4 : Math.max(4, Math.round((inspected / peakHour) * 64));
              return (
                <div key={hour} className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end bg-steel">
                    <div
                      className={`w-full ${nio > 0 ? "bg-nio" : "bg-amber"}`}
                      style={{ height }}
                      title={`${String(hour).padStart(2, "0")}: ${inspected} / ${nio} NIO`}
                    />
                  </div>
                  <span className="font-display text-[10px] text-mist">{String(hour).padStart(2, "0")}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {board ? (
        <div className="grid gap-3 md:grid-cols-3">
          {board.stations.map((column, index) => (
            <section key={column.station} className="border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <h2 className="font-display text-2xl tracking-wide">
                  {index + 1} {de.stations[column.station]}
                </h2>
                <span className="text-xs text-mist">
                  {formatCount(column.inspected)} · NIO {formatPercent(column.nioRate)}
                </span>
              </div>
              <ol className="flex flex-col">
                {column.last.map((cell) => (
                  <li key={`${cell.station}-${cell.dmc}-${cell.capturedAt}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2 text-left hover:bg-steel"
                      onClick={() => navigate(`/zelle/${cell.dmc}`)}
                    >
                      <Pill ok={cell.partOk} label={cell.partOk ? "IO" : "NIO"} />
                      <span className="font-mono text-xs">{cell.dmc}</span>
                      <span className="text-xs text-mist">
                        {cell.defectClass?.replaceAll("_", " ") ??
                          (cell.spanMm === null ? "—" : `${cell.spanMm.toFixed(3)} mm`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      {board && board.defects.length > 0 ? (
        <section className="border border-line bg-panel p-3">
          <h2 className="mb-2 font-display text-2xl tracking-wide">{de.mischung}</h2>
          <div className="flex flex-wrap gap-2">
            {board.defects.map((item) => (
              <span key={item.defectClass} className="border border-line bg-steel px-2 py-1 text-xs">
                {item.defectClass.replaceAll("_", " ")}
                <span className="ml-2 text-amber">{formatCount(item.count)}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {board ? (
        <p className="text-xs text-mist">
          {board._provenance.store} · {board._provenance.query} · {formatWhen(new Date())} Europe/Zurich
          · <Link className="text-amber" to="/band">Band</Link>
        </p>
      ) : null}
    </div>
  );
}
