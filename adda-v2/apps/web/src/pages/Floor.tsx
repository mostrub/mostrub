import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { de, type Lens } from "../i18n/de.ts";
import {
  api,
  ApiError,
  type CaseRecord,
  type Chronik,
  type Dossier,
  type LakeStatus,
  type LineBoard,
  type LineCell,
  type ShiftReport,
} from "../lib/api.ts";
import { formatCount, formatDay, formatPercent, formatRate, formatWhen, verdictLabel } from "../lib/format.ts";
import { Lcd, Note } from "../ui.tsx";

const LENSES = [
  "maschine",
  "tablett",
  "fach",
  "fenster",
  "klasse",
  "schicht",
  "see",
] as const satisfies readonly Lens[];

function isLens(value: string | null): value is Lens {
  return value !== null && LENSES.some((id) => id === value);
}
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SPAN_LIMIT = 0.12;
const BIN_W = 0.02;
const DEFECT_CLASSES = [
  "Span",
  "Zink",
  "Kratzer",
  "Dichtungsbraue",
  "Abgeschabte_Dichtung",
  "Ausgezogene_Dichtung",
  "Elektrolyt_Flecken",
  "Nicht_geschlossen",
  "Paste",
  "Separator",
  "Verletzung_Becherrand",
] as const;

function fmtMm(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(3)} mm`;
}

function zurichHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

function zurichClock(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

function defectLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function latestInspection(dossier: Dossier | null) {
  const rows = dossier?.inspections ?? [];
  return rows.reduce<(typeof rows)[number] | null>((best, row) => {
    if (!best) return row;
    return +new Date(row.capturedAt) >= +new Date(best.capturedAt) ? row : best;
  }, null);
}

function latestCell(cells: LineCell[], dmc: string): LineCell | null {
  return cells.reduce<LineCell | null>((best, cell) => {
    if (cell.dmc !== dmc) return best;
    if (!best) return cell;
    return +new Date(cell.capturedAt) >= +new Date(best.capturedAt) ? cell : best;
  }, null);
}

export function Floor() {
  const { dmc: routeDmc, id: caseId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sicht = params.get("sicht");
  const lens: Lens = isLens(sicht) ? sicht : "maschine";
  const [board, setBoard] = useState<LineBoard | null>(null);
  const [tape, setTape] = useState<Chronik | null>(null);
  const [shift, setShift] = useState<ShiftReport | null>(null);
  const [lake, setLake] = useState<LakeStatus | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(routeDmc ?? "");
  const [travelId, setTravelId] = useState("");
  const [travel, setTravel] = useState<Dossier | null>(null);
  const [travelMissing, setTravelMissing] = useState(false);
  const [akte, setAkte] = useState<CaseRecord | null>(null);
  const [akteBusy, setAkteBusy] = useState(false);
  const [akteError, setAkteError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.allSettled([api.linie(), api.chronik(), api.schicht(), api.lake()]).then(
        (results) => {
          if (cancelled) return;
          const [linie, chronik, schicht, lakeStatus] = results;
          if (linie.status === "fulfilled") setBoard(linie.value);
          if (chronik.status === "fulfilled") setTape(chronik.value);
          if (schicht.status === "fulfilled") setShift(schicht.value);
          if (lakeStatus.status === "fulfilled") setLake(lakeStatus.value);
          const fail = results.find((item) => item.status === "rejected");
          if (fail && fail.status === "rejected") {
            const err = fail.reason;
            setError(err instanceof ApiError ? err.message : de.lakeDown);
          } else {
            setError(null);
          }
        },
      );
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
      .then((next) => {
        setDossier(next);
        setAkte(next.openCases?.[0] ?? null);
      })
      .catch((err: unknown) => {
        setDossier(null);
        if (err instanceof ApiError && err.status === 503) setError(err.message);
      });
  }, [selected]);

  useEffect(() => {
    if (!selected || !travelId) {
      setTravel(null);
      setTravelMissing(false);
      return;
    }
    api
      .cellAt(Number(travelId), selected)
      .then((next) => {
        setTravel(next);
        setTravelMissing(false);
      })
      .catch((err: unknown) => {
        setTravel(null);
        if (err instanceof ApiError && err.status === 404) {
          setTravelMissing(true);
          return;
        }
        setTravelMissing(false);
        if (err instanceof ApiError && err.status === 503) setError(err.message);
      });
  }, [selected, travelId]);

  useEffect(() => {
    if (!caseId) return;
    api
      .case(caseId)
      .then((record) => {
        setSelected(record.dmc);
        setAkte(record);
      })
      .catch(() => undefined);
  }, [caseId]);

  const peakHour = board?.hours.reduce((max, row) => Math.max(max, row.inspected), 0) ?? 0;
  const selectedCell = board ? latestCell(board.cells, selected) : null;
  const seeded = Boolean(board?.cells.length && board.cells.every((cell) => cell.source === "seed"));

  function pick(dmc: string) {
    setSelected(dmc);
    setTravelId("");
    setTravel(null);
    setTravelMissing(false);
    setAkteError(null);
    navigate(`/zelle/${dmc}`);
  }

  return (
    <div className="chassis">
      <header className="bezel">
        <div>
          <span className="brand-mark">{de.instrument}</span>
          <span className="brand-sub">
            {de.line} · {de.site}
          </span>
        </div>
        <nav className="lenses" aria-label={de.lensesTitle}>
          {LENSES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === lens}
              className={id === lens ? "is-on" : undefined}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("sicht", id);
                setParams(next, { replace: true });
              }}
            >
              <span>{de.lenses[id]}</span>
              <small>{de.lensHint[id]}</small>
            </button>
          ))}
        </nav>
        {board ? (
          <div className="bezel-readouts">
            <Lcd label={de.kpis.cells} value={formatCount(board.inspected)} />
            <Lcd label={de.kpis.nio} value={formatCount(board.nio)} warn={board.nio > 0} />
            <Lcd label={de.kpis.yield} value={formatPercent(board.yield)} warn={(board.yield ?? 1) < 0.8} />
            <Lcd label={de.kpis.takt} value={formatRate(board.taktPerHour)} />
            <Lcd label={de.kpis.snap} value={String(board.snapshotId)} />
            <Lcd label={de.kpis.clock} value={zurichClock(now)} />
          </div>
        ) : null}
      </header>

      {error ? <div className="bezel-alert">{error}</div> : null}
      {seeded ? <div className="bezel-alert is-seed">{de.seed}</div> : null}

      <section className="takt-strip" aria-label={de.takt}>
        <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.2em] text-mute">
          <span>{de.takt}</span>
          <span>{de.taktHint}</span>
        </div>
        <div className="takt-grid">
          {HOURS.map((hour) => {
            const row = board?.hours.find((item) => item.hour === hour);
            const inspected = row?.inspected ?? 0;
            const nio = row?.nio ?? 0;
            const fill = peakHour === 0 ? 0 : inspected / peakHour;
            return (
              <div
                key={hour}
                title={`${String(hour).padStart(2, "0")} · ${inspected} · ${nio} NIO`}
                className="takt-col"
              >
                <div className="takt-well">
                  <div
                    className={`takt-fill ${nio > 0 ? "is-nio" : "is-io"}`}
                    style={{ height: `${Math.round(fill * 100)}%` }}
                  />
                  {nio > 0 ? <span className="takt-tick" /> : null}
                </div>
                <span className="takt-label">{String(hour).padStart(2, "0")}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="well">
        {board && board.inspected === 0 ? <Note>{de.empty}</Note> : null}
        <LensWell
          lens={lens}
          board={board}
          shift={shift}
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
          travelMissing={travelMissing}
          akte={akte}
          akteBusy={akteBusy}
          akteError={akteError}
          onOpen={async () => {
            if (!selected) return;
            setAkteBusy(true);
            setAkteError(null);
            try {
              const opened = await api.openCase({
                dmc: selected,
                title: `${selectedCell && !selectedCell.partOk ? de.io.nio : de.io.io} ${selected}`,
                openedBy: "kaliber",
              });
              setAkte(opened);
            } catch (err: unknown) {
              setAkteError(err instanceof ApiError ? err.message : de.lakeDown);
            } finally {
              setAkteBusy(false);
            }
          }}
        />
        {shift ? (
          <article>
            <h3>{de.schicht}</h3>
            <p className="text-sm">
              {formatCount(shift.io)} {de.io.io} / {formatCount(shift.nio)} {de.io.nio} ·{" "}
              {formatPercent(shift.yield)}
            </p>
            <ol className="schicht-mix">
              {shift.defects.slice(0, 5).map((item) => (
                <li key={item.defectClass}>
                  {defectLabel(item.defectClass)} {formatCount(item.count)}
                </li>
              ))}
            </ol>
          </article>
        ) : null}
      </aside>

      {tape ? <Band events={tape.events} selected={selected} onPick={pick} /> : null}
    </div>
  );
}

function LensWell({
  lens,
  board,
  shift,
  lake,
  selected,
  travelId,
  onPick,
  onTravelId,
}: {
  lens: Lens;
  board: LineBoard | null;
  shift: ShiftReport | null;
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
    case "fach":
      return <Fach board={board} selected={selected} onPick={onPick} />;
    case "fenster":
      return <Fenster board={board} selected={selected} onPick={onPick} />;
    case "klasse":
      return <Klasse board={board} onPick={onPick} />;
    case "schicht":
      return <Schicht board={board} shift={shift} onPick={onPick} />;
    case "see":
      return <See lake={lake} selected={selected} travelId={travelId} onTravelId={onTravelId} />;
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
      <p className="lede">{de.maschineLede}</p>
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
                <li key={`${cell.dmc}-${cell.capturedAt}`}>
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
  const trays = board?.trays ?? [];
  return (
    <section>
      <h2>{de.lenses.tablett}</h2>
      <p className="lede">{de.tablettLede}</p>
      <div className="magazine">
        {(trays.length ? trays : []).map((tray) => {
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
        {!trays.length ? (
          <article>
            <ol className="pockets">
              {Array.from({ length: 12 }, (_, i) => (
                <li key={i}>
                  <span className="pocket-empty">
                    <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  </span>
                </li>
              ))}
            </ol>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function Fach({
  board,
  selected,
  onPick,
}: {
  board: LineBoard | null;
  selected: string;
  onPick: (dmc: string) => void;
}) {
  const slots = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const slot = index + 1;
      const cells = (board?.cells ?? []).filter((cell) => cell.slot === slot);
      const nio = cells.filter((cell) => !cell.partOk);
      return { slot, cells, nio };
    });
  }, [board]);
  return (
    <section>
      <h2>{de.lenses.fach}</h2>
      <p className="lede">{de.fachLede}</p>
      <ol className="fach-rail">
        {slots.map((row) => {
          const rate = row.cells.length === 0 ? null : row.nio.length / row.cells.length;
          const pickCell = row.nio[0] ?? row.cells[row.cells.length - 1];
          return (
            <li key={row.slot}>
              <button
                type="button"
                className={[
                  row.nio.length ? "is-nio" : "is-io",
                  pickCell && pickCell.dmc === selected ? "is-picked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!pickCell}
                onClick={() => pickCell && onPick(pickCell.dmc)}
              >
                <span className="mono">{String(row.slot).padStart(2, "0")}</span>
                <Lcd label={de.kpis.nio} value={formatCount(row.nio.length)} warn={row.nio.length > 0} />
                <span>{formatPercent(rate)}</span>
              </button>
              <ol className="fach-dmcs">
                {row.cells.map((cell) => (
                  <li key={`${cell.dmc}-${cell.capturedAt}`}>
                    <button
                      type="button"
                      className={[!cell.partOk ? "is-nio" : "", cell.dmc === selected ? "is-picked" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onPick(cell.dmc)}
                    >
                      {cell.dmc.slice(-6)}
                    </button>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Schicht({
  board,
  shift,
  onPick,
}: {
  board: LineBoard | null;
  shift: ShiftReport | null;
  onPick: (dmc: string) => void;
}) {
  return (
    <section>
      <h2>{de.lenses.schicht}</h2>
      <p className="lede">{de.schichtLede}</p>
      {shift ? (
        <>
          <div className="span-readouts">
            <Lcd label={de.kpis.cells} value={formatCount(shift.inspected)} />
            <Lcd label={de.io.io} value={formatCount(shift.io)} />
            <Lcd label={de.kpis.nio} value={formatCount(shift.nio)} warn={shift.nio > 0} />
            <Lcd label={de.kpis.yield} value={formatPercent(shift.yield)} warn={(shift.yield ?? 1) < 0.8} />
          </div>
          <p className="hint">
            {formatDay(shift.from)} → {formatWhen(shift.to)}
          </p>
          <ol className="schicht-defects">
            {shift.defects.map((item) => {
              const hit = board?.cells.find((cell) => cell.defectClass === item.defectClass && !cell.partOk);
              return (
                <li key={item.defectClass}>
                  <button type="button" disabled={!hit} onClick={() => hit && onPick(hit.dmc)}>
                    <span>{defectLabel(item.defectClass)}</span>
                    <span className="mono">{formatCount(item.count)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="hint">{de.empty}</p>
      )}
    </section>
  );
}

function Fenster({
  board,
  selected,
  onPick,
}: {
  board: LineBoard | null;
  selected: string;
  onPick: (dmc: string) => void;
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
  const mark = board ? latestCell(board.cells, selected)?.spanMm ?? null : null;
  const offenders = (board?.cells ?? [])
    .filter((cell) => cell.spanMm !== null && cell.spanMm > SPAN_LIMIT)
    .slice()
    .sort((a, b) => (b.spanMm ?? 0) - (a.spanMm ?? 0));
  return (
    <section>
      <h2>{de.lenses.fenster}</h2>
      <p className="lede">{de.fensterLede}</p>
      <div className="span-readouts">
        <Lcd label={de.span.min} value={fmtMm(span?.min ?? null)} />
        <Lcd label={de.span.p50} value={fmtMm(span?.p50 ?? null)} />
        <Lcd label={de.span.p95} value={fmtMm(span?.p95 ?? null)} warn={(span?.p95 ?? 0) > SPAN_LIMIT} />
        <Lcd label={de.span.max} value={fmtMm(span?.max ?? null)} warn={(span?.max ?? 0) > SPAN_LIMIT} />
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
                {bin.lo >= 0.22 ? "≥0,22" : bin.lo.toFixed(2)}
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
          <circle cx={20 + Math.min(mark, 0.23) / BIN_W * 36} cy={22} r={5} fill="var(--color-pick)" />
        ) : null}
      </svg>
      <p className="hint">
        {de.span.limit} · n={formatCount(hist.values.length)}
      </p>
      <h3 className="subhead">{de.span.offenders}</h3>
      <ol className="last-cells">
        {offenders.slice(0, 12).map((cell) => (
          <li key={`${cell.dmc}-${cell.capturedAt}`}>
            <CellRow cell={cell} selected={selected} onPick={onPick} extra={fmtMm(cell.spanMm)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Klasse({
  board,
  onPick,
}: {
  board: LineBoard | null;
  onPick: (dmc: string) => void;
}) {
  const grid = useMemo(() => {
    const cells = board?.cells ?? [];
    return DEFECT_CLASSES.map((cls) => {
      const counts = HOURS.map(
        (hour) => cells.filter((cell) => cell.defectClass === cls && zurichHour(cell.capturedAt) === hour).length,
      );
      return { cls, counts, total: counts.reduce((a, b) => a + b, 0) };
    });
  }, [board]);
  const max = Math.max(1, ...grid.flatMap((row) => row.counts));
  return (
    <section>
      <h2>{de.lenses.klasse}</h2>
      <p className="lede">{de.klasseLede}</p>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th>{de.klasse.cls}</th>
              {HOURS.map((hour) => (
                <th key={hour}>{String(hour).padStart(2, "0")}</th>
              ))}
              <th>Σ</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.cls}>
                <th>{defectLabel(row.cls)}</th>
                {row.counts.map((n, i) => {
                  const hour = HOURS[i] ?? 0;
                  return (
                    <td key={hour}>
                      <button
                        type="button"
                        className="heat"
                        style={{ width: `${Math.max(18, (n / max) * 36)}px` }}
                        onClick={() => {
                          const hit = board?.cells.find(
                            (cell) => cell.defectClass === row.cls && zurichHour(cell.capturedAt) === hour,
                          );
                          if (hit) onPick(hit.dmc);
                        }}
                      >
                        {n}
                      </button>
                    </td>
                  );
                })}
                <td className="mono">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const snaps = [...(lake?.snapshots ?? [])]
    .reverse()
    .filter((snap) => snap.commitMessage || snap.author);
  return (
    <section>
      <h2>{de.lenses.see}</h2>
      <p className="lede">
        {de.seeLede} Snap #{lake?.currentSnapshotId ?? "—"} {de.see.current}.
      </p>
      {!selected ? <p className="hint">{de.see.needCell}</p> : null}
      <ol className="film">
        {snaps.map((snap) => (
          <li key={snap.snapshotId}>
            <button
              type="button"
              className={[
                String(snap.snapshotId) === travelId ? "is-on" : "",
                selected ? "" : "is-dim",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!selected}
              onClick={() =>
                onTravelId(String(snap.snapshotId) === travelId ? "" : String(snap.snapshotId))
              }
            >
              <span className="mono">#{snap.snapshotId}</span>
              <span>{formatWhen(snap.snapshotTime)}</span>
              <span>{snap.snapshotId === lake?.currentSnapshotId ? de.see.current : de.see.travel}</span>
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
  extra,
}: {
  cell: LineCell;
  selected: string;
  onPick: (dmc: string) => void;
  extra?: string;
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
      <span>{extra ?? formatWhen(cell.capturedAt)}</span>
    </button>
  );
}

function Band({
  events,
  selected,
  onPick,
}: {
  events: Chronik["events"];
  selected: string;
  onPick: (dmc: string) => void;
}) {
  const ticks = events.filter((event, index, all) => {
    const stamp = event.at.slice(0, 19);
    return all.findIndex((item) => item.dmc === event.dmc && item.at.slice(0, 19) === stamp) === index;
  });
  return (
    <section className="tape" aria-label={de.band}>
      <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-mute">{de.band}</div>
      <div className="tape-row">
        {ticks.map((event, index) => {
          const nio = verdictLabel(event.summary) === "NIO";
          return (
            <button
              key={`${event.dmc}-${event.at}-${index}`}
              type="button"
              aria-label={`${event.dmc} ${event.summary}`}
              title={`${event.dmc} ${event.summary}`}
              className={[nio ? "is-nio" : "", event.dmc === selected ? "is-picked" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onPick(event.dmc)}
            >
              {event.dmc.slice(-4)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Coupon({
  selected,
  selectedCell,
  dossier,
  travel,
  travelId,
  travelMissing,
  akte,
  akteBusy,
  akteError,
  onOpen,
}: {
  selected: string;
  selectedCell: LineCell | null;
  dossier: Dossier | null;
  travel: Dossier | null;
  travelId: string;
  travelMissing: boolean;
  akte: CaseRecord | null;
  akteBusy: boolean;
  akteError: string | null;
  onOpen: () => Promise<void>;
}) {
  if (!selected) return <p className="hint">{de.pick}</p>;
  const live = latestInspection(dossier);
  const shown = travelId ? (travelMissing ? null : latestInspection(travel)) : live;
  const spanMm = travel
    ? (shown?.measurements?.spanMm ?? null)
    : (selectedCell?.spanMm ?? shown?.measurements?.spanMm ?? null);
  const nio = shown ? !shown.partOk : Boolean(selectedCell && !selectedCell.partOk);
  const source = shown?.source ?? selectedCell?.source;
  return (
    <article>
      <h3>{de.coupon}</h3>
      {travelId ? (
        <p className="hint">
          {de.see.travel} #{travelId}
          {travelMissing ? ` · ${de.see.missing}` : ""}
        </p>
      ) : null}
      <p className={`dmc-ticket ${nio ? "is-nio" : ""}`}>{selected}</p>
      <div className="mb-2 flex flex-col gap-1">
        <Lcd
          label={de.fach}
          value={`${selectedCell?.tray ?? shown?.tray ?? "—"} / ${selectedCell?.slot ?? shown?.slot ?? "—"}`}
        />
        <Lcd label={de.span.title} value={travelMissing ? de.see.missing : fmtMm(spanMm)} warn={(spanMm ?? 0) > SPAN_LIMIT} />
      </div>
      <ul className="defects text-sm">
        {travelMissing ? (
          <li>{de.see.missing}</li>
        ) : shown?.findings.length ? (
          shown.findings.map((item) => <li key={item.defectClass}>{defectLabel(item.defectClass)}</li>)
        ) : selectedCell?.defectClass && !travelId ? (
          <li>{defectLabel(selectedCell.defectClass)}</li>
        ) : (
          <li>{de.io.io}</li>
        )}
      </ul>
      {source === "seed" ? <p className="hint">{de.seed}</p> : null}
      {akte ? (
        <p className="hint">
          {de.akteNr} {akte.id} · {akte.status}
        </p>
      ) : null}
      {akteError ? <Note>{akteError}</Note> : null}
      <button
        type="button"
        className="mt-3 w-full border border-ice bg-well px-2 py-1.5 text-xs uppercase tracking-[0.16em] text-ice"
        disabled={akteBusy}
        onClick={() => void onOpen()}
      >
        {akteBusy ? de.openingCase : de.openCase}
      </button>
    </article>
  );
}
