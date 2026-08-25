import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { de, type Lens } from "../i18n/de.ts";
import {
  api,
  ApiError,
  type Chronik,
  type Dossier,
  type LakeStatus,
  type LineBoard,
  type LineCell,
  type ShiftReport,
} from "../lib/api.ts";
import { formatCount, formatPercent, formatWhen, verdictLabel } from "../lib/format.ts";
import { Lcd, Note } from "../ui.tsx";

const LENSES = ["maschine", "tablett", "fenster", "klasse", "see"] as const satisfies readonly Lens[];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SPAN_LIMIT = 0.12;
const BIN_W = 0.02;

function fmtMm(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(3)} mm`;
}

function zurichHour(iso: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return Number(hour);
}

function defectLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function Floor() {
  const { dmc: routeDmc, id: caseId } = useParams();
  const navigate = useNavigate();
  const [lens, setLens] = useState<Lens>("maschine");
  const [board, setBoard] = useState<LineBoard | null>(null);
  const [tape, setTape] = useState<Chronik | null>(null);
  const [shift, setShift] = useState<ShiftReport | null>(null);
  const [lake, setLake] = useState<LakeStatus | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(routeDmc ?? "");
  const [travelId, setTravelId] = useState("");
  const [travel, setTravel] = useState<Dossier | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([api.linie(), api.chronik(), api.schicht(), api.lake()])
        .then(([nextBoard, nextTape, nextShift, nextLake]) => {
          if (cancelled) return;
          setBoard(nextBoard);
          setTape(nextTape);
          setShift(nextShift);
          setLake(nextLake);
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

  useEffect(() => {
    if (routeDmc) setSelected(routeDmc);
  }, [routeDmc]);

  useEffect(() => {
    if (!selected) {
      setDossier(null);
      return;
    }
    api
      .cell(selected)
      .then(setDossier)
      .catch(() => setDossier(null));
  }, [selected]);

  useEffect(() => {
    if (!selected || !travelId) {
      setTravel(null);
      return;
    }
    api
      .cellAt(Number(travelId), selected)
      .then(setTravel)
      .catch(() => setTravel(null));
  }, [selected, travelId]);

  useEffect(() => {
    if (!caseId) return;
    api
      .case(caseId)
      .then((record) => {
        setSelected(record.dmc);
        navigate(`/zelle/${record.dmc}`, { replace: true });
      })
      .catch(() => undefined);
  }, [caseId, navigate]);

  const peakHour = board?.hours.reduce((max, row) => Math.max(max, row.inspected), 0) ?? 0;
  const selectedCell = board?.cells.find((cell) => cell.dmc === selected) ?? null;

  function pick(dmc: string) {
    setSelected(dmc);
    setTravelId("");
    navigate(`/zelle/${dmc}`);
  }

  return (
    <div className="chassis">
      <header className="bezel">
        <div>
          <span className="brand-mark">{de.instrument}</span>
          <span className="brand-sub">
            {de.line} · {de.product}
          </span>
        </div>
        <nav className="lenses" aria-label={de.lensesTitle}>
          {LENSES.map((id) => (
            <button
              key={id}
              type="button"
              className={id === lens ? "is-on" : undefined}
              onClick={() => setLens(id)}
            >
              {de.lenses[id]}
            </button>
          ))}
        </nav>
        {board ? (
          <div className="bezel-readouts">
            <Lcd label={de.kpis.cells} value={formatCount(board.inspected)} />
            <Lcd label={de.kpis.nio} value={formatCount(board.nio)} warn={board.nio > 0} />
            <Lcd label={de.kpis.yield} value={formatPercent(board.yield)} warn={(board.yield ?? 1) < 0.8} />
            <Lcd
              label={de.kpis.takt}
              value={board.taktPerHour === null ? "—" : formatCount(Math.round(board.taktPerHour))}
            />
            <Lcd label={de.kpis.snap} value={String(board.snapshotId)} />
          </div>
        ) : null}
      </header>

      <section className="takt-strip" aria-label={de.takt}>
        <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.2em] text-mute">
          <span>{de.takt}</span>
          <span>{de.taktHint}</span>
        </div>
        <div className="grid h-10 grid-cols-[repeat(24,minmax(0,1fr))] border border-bezel bg-well">
          {HOURS.map((hour) => {
            const row = board?.hours.find((item) => item.hour === hour);
            const inspected = row?.inspected ?? 0;
            const nio = row?.nio ?? 0;
            const fill = peakHour === 0 ? 0 : inspected / peakHour;
            return (
              <div
                key={hour}
                title={`${String(hour).padStart(2, "0")} · ${inspected} · ${nio} NIO`}
                className="relative border-l border-steel/30 first:border-l-0"
              >
                <div
                  className={`absolute inset-x-0 bottom-0 ${nio > 0 ? "bg-nio" : "bg-ice"}`}
                  style={{ height: `${Math.round(fill * 100)}%`, opacity: nio > 0 ? 0.9 : 0.45 }}
                />
                <span className="absolute bottom-0 left-0.5 text-[9px] text-ice/70">
                  {String(hour).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="well">
        {error ? <Note>{error}</Note> : null}
        {board && board.inspected === 0 ? <Note>{de.empty}</Note> : null}
        <LensWell
          lens={lens}
          board={board}
          lake={lake}
          selected={selected}
          travelId={travelId}
          onPick={pick}
          onTravelId={setTravelId}
        />
      </div>

      <aside className="coupon" aria-label={de.coupon}>
        <Coupon
          selected={selected}
          selectedCell={selectedCell}
          dossier={dossier}
          travel={travel}
          travelId={travelId}
          onOpened={(id) => navigate(`/akte/${id}`)}
        />
        {shift ? (
          <article>
            <h3>{de.schicht}</h3>
            <p className="text-sm">
              {formatCount(shift.io)} {de.io.io} / {formatCount(shift.nio)} {de.io.nio} ·{" "}
              {formatPercent(shift.yield)}
            </p>
          </article>
        ) : null}
      </aside>

      {tape ? (
        <section className="tape" aria-label={de.band}>
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-mute">{de.band}</div>
          <div className="tape-row">
            {tape.events.map((event, index) => {
              const nio = verdictLabel(event.summary) === "NIO";
              return (
                <button
                  key={`${event.dmc}-${event.at}-${index}`}
                  type="button"
                  title={`${event.dmc} ${event.summary}`}
                  className={[nio ? "is-nio" : "", event.dmc === selected ? "is-picked" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(event.dmc)}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LensWell({
  lens,
  board,
  lake,
  selected,
  travelId,
  onPick,
  onTravelId,
}: {
  lens: Lens;
  board: LineBoard | null;
  lake: LakeStatus | null;
  selected: string;
  travelId: string;
  onPick: (dmc: string) => void;
  onTravelId: (id: string) => void;
}) {
  switch (lens) {
    case "maschine":
      return <Maschine board={board} selected={selected} onPick={onPick} />;
    case "tablett":
      return <Tablett board={board} selected={selected} onPick={onPick} />;
    case "fenster":
      return <Fenster board={board} selected={selected} />;
    case "klasse":
      return <Klasse board={board} />;
    case "see":
      return (
        <See
          lake={lake}
          selected={selected}
          travelId={travelId}
          onTravelId={onTravelId}
        />
      );
    default: {
      const _never: never = lens;
      return _never;
    }
  }
}

function Maschine({
  board,
  selected,
  onPick,
}: {
  board: LineBoard | null;
  selected: string;
  onPick: (dmc: string) => void;
}) {
  return (
    <section>
      <h2>{de.lenses.maschine}</h2>
      <p className="lede">Anode → Kathode → OQC. Letzte Zellen je Station.</p>
      <ol className="stations">
        {(board?.stations ?? []).map((st) => (
          <li key={st.station}>
            <header>
              <strong>{de.stations[st.station]}</strong>
              <span>{formatPercent(st.nioRate)}</span>
            </header>
            <div className="station-lcd">
              <Lcd label={de.kpis.cells} value={formatCount(st.inspected)} />
              <Lcd label={de.kpis.nio} value={formatCount(st.nio)} warn={st.nio > 0} />
            </div>
            <ol className="last-cells">
              {st.last.map((cell) => (
                <li key={cell.dmc}>
                  <CellRow cell={cell} selected={selected} onPick={onPick} />
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tablett({
  board,
  selected,
  onPick,
}: {
  board: LineBoard | null;
  selected: string;
  onPick: (dmc: string) => void;
}) {
  return (
    <section>
      <h2>{de.lenses.tablett}</h2>
      <p className="lede">12 Fächer je Magazin. Antippen öffnet den Kupon.</p>
      <div className="magazine">
        {(board?.trays ?? []).map((tray) => {
          const nio = tray.slots.reduce(
            (sum, slot) => sum + slot.cells.filter((cell) => !cell.partOk).length,
            0,
          );
          const cells = tray.slots.reduce((sum, slot) => sum + slot.cells.length, 0);
          return (
            <article key={tray.tray}>
              <header>
                <strong>{tray.tray}</strong>
                <span>
                  {formatCount(nio)} NIO · {formatCount(cells)} Zellen
                </span>
              </header>
              <ol className="pockets">
                {tray.slots.map((slot) => {
                  const latest = slot.cells[slot.cells.length - 1];
                  const bad = slot.cells.some((cell) => !cell.partOk);
                  return (
                    <li key={`${tray.tray}-${slot.slot}`}>
                      {latest ? (
                        <button
                          type="button"
                          className={[bad ? "is-nio" : "is-io", latest.dmc === selected ? "is-picked" : ""]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => onPick(latest.dmc)}
                        >
                          <span className="mono">{String(slot.slot).padStart(2, "0")}</span>
                          <span className="mono">{latest.dmc.slice(-6)}</span>
                        </button>
                      ) : (
                        <span className="pocket-empty">
                          <span className="mono">{String(slot.slot).padStart(2, "0")}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Fenster({
  board,
  selected,
}: {
  board: LineBoard | null;
  selected: string;
}) {
  const hist = useMemo(() => {
    const values = (board?.cells ?? [])
      .map((cell) => cell.spanMm)
      .filter((n): n is number => n !== null);
    const bins: { lo: number; n: number }[] = [];
    for (let lo = 0; lo < 0.24; lo += BIN_W) bins.push({ lo: Number(lo.toFixed(2)), n: 0 });
    for (const value of values) {
      const i = Math.min(bins.length - 1, Math.max(0, Math.floor(value / BIN_W)));
      const bin = bins[i];
      if (bin) bin.n += 1;
    }
    return { bins, values };
  }, [board]);
  const max = Math.max(1, ...hist.bins.map((bin) => bin.n));
  const span = board?.spanWindow;
  const mark = board?.cells.find((cell) => cell.dmc === selected)?.spanMm ?? null;
  return (
    <section>
      <h2>{de.lenses.fenster}</h2>
      <p className="lede">{de.span.limit}. p50/p95 aus dem aktuellen Snap.</p>
      <div className="span-readouts">
        <Lcd label={de.span.min} value={fmtMm(span?.min ?? null)} />
        <Lcd label={de.span.p50} value={fmtMm(span?.p50 ?? null)} />
        <Lcd label={de.span.p95} value={fmtMm(span?.p95 ?? null)} />
        <Lcd
          label={de.span.max}
          value={fmtMm(span?.max ?? null)}
          warn={(span?.max ?? 0) > SPAN_LIMIT}
        />
      </div>
      <svg className="hist" viewBox="0 0 480 160" role="img" aria-label={de.span.title}>
        {hist.bins.map((bin, i) => {
          const x = 20 + i * 36;
          const h = (bin.n / max) * 120;
          const over = bin.lo + BIN_W > SPAN_LIMIT;
          return (
            <g key={bin.lo}>
              <rect
                x={x}
                y={140 - h}
                width={28}
                height={h}
                fill={over ? "var(--color-nio)" : "var(--color-ice)"}
                opacity={0.85}
              />
              <text x={x + 14} y={154} textAnchor="middle" fill="currentColor" fontSize="8">
                {bin.lo.toFixed(2)}
              </text>
            </g>
          );
        })}
        <line
          x1={20 + (SPAN_LIMIT / BIN_W) * 36}
          x2={20 + (SPAN_LIMIT / BIN_W) * 36}
          y1={12}
          y2={140}
          stroke="var(--color-pick)"
          strokeDasharray="3 3"
        />
        {mark !== null ? (
          <circle
            cx={20 + (mark / BIN_W) * 36}
            cy={18}
            r={4}
            fill="var(--color-pick)"
          />
        ) : null}
      </svg>
      <p className="hint">
        {de.span.limit} · n={formatCount(hist.values.length)}
        {mark !== null ? ` · mark ${fmtMm(mark)}` : ""}
      </p>
    </section>
  );
}

function Klasse({ board }: { board: LineBoard | null }) {
  const grid = useMemo(() => {
    const hours = [6, 14, 22];
    const classes = [...new Set((board?.cells ?? []).map((cell) => cell.defectClass).filter(Boolean))] as string[];
    const known = board?.defects.map((item) => item.defectClass) ?? [];
    const rows = [...new Set([...known, ...classes])].map((cls) => {
      const cells = hours.map(
        (hour) =>
          (board?.cells ?? []).filter(
            (cell) => cell.defectClass === cls && zurichHour(cell.capturedAt) === hour,
          ).length,
      );
      return { cls, cells, total: cells.reduce((a, b) => a + b, 0) };
    });
    return { hours, rows };
  }, [board]);
  const max = Math.max(1, ...grid.rows.flatMap((row) => row.cells));
  return (
    <section>
      <h2>{de.lenses.klasse}</h2>
      <p className="lede">{de.klasse.title}. Seed-Schichten 06 / 14 / 22.</p>
      <table className="matrix">
        <thead>
          <tr>
            <th>{de.klasse.cls}</th>
            {grid.hours.map((hour) => (
              <th key={hour}>{String(hour).padStart(2, "0")}:00</th>
            ))}
            <th>Σ</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.cls}>
              <th>{defectLabel(row.cls)}</th>
              {row.cells.map((n, i) => (
                <td key={grid.hours[i]}>
                  <span className="heat" style={{ opacity: 0.12 + (n / max) * 0.88 }}>
                    {n || "·"}
                  </span>
                </td>
              ))}
              <td className="mono">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function See({
  lake,
  selected,
  travelId,
  onTravelId,
}: {
  lake: LakeStatus | null;
  selected: string;
  travelId: string;
  onTravelId: (id: string) => void;
}) {
  const snaps = [...(lake?.snapshots ?? [])].reverse();
  return (
    <section>
      <h2>{de.lenses.see}</h2>
      <p className="lede">
        Snap #{lake?.currentSnapshotId ?? "—"} · {de.see.travel} lädt den Kupon auf den gewählten Stand.
      </p>
      {!selected ? <p className="hint">{de.see.needCell}</p> : null}
      <ol className="film">
        {snaps.map((snap) => (
          <li key={snap.snapshotId}>
            <button
              type="button"
              className={String(snap.snapshotId) === travelId ? "is-on" : undefined}
              disabled={!selected}
              onClick={() =>
                onTravelId(String(snap.snapshotId) === travelId ? "" : String(snap.snapshotId))
              }
            >
              <span className="mono">#{snap.snapshotId}</span>
              <span>{formatWhen(snap.snapshotTime)}</span>
              <span>{snap.commitMessage ?? snap.author ?? "—"}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CellRow({
  cell,
  selected,
  onPick,
}: {
  cell: LineCell;
  selected: string;
  onPick: (dmc: string) => void;
}) {
  return (
    <button
      type="button"
      className={[!cell.partOk ? "is-nio" : "is-io", cell.dmc === selected ? "is-picked" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onPick(cell.dmc)}
    >
      <span className="mono">{cell.dmc}</span>
      <span>{cell.partOk ? de.io.io : de.io.nio}</span>
      <span>{formatWhen(cell.capturedAt)}</span>
    </button>
  );
}

function Coupon({
  selected,
  selectedCell,
  dossier,
  travel,
  travelId,
  onOpened,
}: {
  selected: string;
  selectedCell: LineCell | null;
  dossier: Dossier | null;
  travel: Dossier | null;
  travelId: string;
  onOpened: (id: string) => void;
}) {
  if (!selected) return <p className="hint">{de.pick}</p>;
  const latest = dossier?.inspections[0];
  const shown = travel?.inspections[0] ?? latest;
  return (
    <article>
      <h3>{de.coupon}</h3>
      {travelId ? (
        <p className="hint">
          {de.see.travel} #{travelId}
        </p>
      ) : null}
      <div className="mb-2 flex flex-col gap-1">
        <Lcd label={de.zelle} value={selected} warn={shown ? !shown.partOk : selectedCell ? !selectedCell.partOk : false} />
        <Lcd
          label="Fach"
          value={`${selectedCell?.tray ?? shown?.tray ?? "—"} / ${selectedCell?.slot ?? shown?.slot ?? "—"}`}
        />
        <Lcd
          label={de.span.title}
          value={fmtMm(selectedCell?.spanMm ?? null)}
          warn={(selectedCell?.spanMm ?? 0) > SPAN_LIMIT}
        />
      </div>
      <ul className="defects text-sm">
        {shown?.findings.length ? (
          shown.findings.map((item) => <li key={item.defectClass}>{defectLabel(item.defectClass)}</li>)
        ) : selectedCell?.defectClass ? (
          <li>{defectLabel(selectedCell.defectClass)}</li>
        ) : (
          <li>{de.io.io}</li>
        )}
      </ul>
      <button
        type="button"
        className="mt-3 w-full border border-ink bg-ink px-2 py-1.5 text-xs uppercase tracking-[0.16em] text-face"
        onClick={async () => {
          const opened = await api.openCase({
            dmc: selected,
            title: `NIO ${selected}`,
            openedBy: "kaliber",
          });
          onOpened(opened.id);
        }}
      >
        {de.openCase}
      </button>
    </article>
  );
}
