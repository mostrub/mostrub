import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import {
  formatCount,
  formatDay,
  formatPercent,
  formatRate,
  formatWhen,
  timelineAxis,
  timelineOffset,
  verdictLabel,
} from "../lib/format.ts";
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

const BERICHTE = ["voll", "stunden", "maschine", "klassen", "nio", "akten"] as const;
type Bericht = (typeof BERICHTE)[number];

function isBericht(value: string | null): value is Bericht {
  return value !== null && BERICHTE.some((id) => id === value);
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

function stationName(station: string): string {
  if (station === "anode" || station === "cathode" || station === "oqc") {
    return de.stations[station];
  }
  return station;
}

function akteStand(status: CaseRecord["status"]): string {
  switch (status) {
    case "open":
      return de.aktenStand.open;
    case "pinned":
      return de.aktenStand.pinned;
    case "closed":
      return de.aktenStand.closed;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function speicherLabel(store: string | undefined): string {
  if (store === "ducklake") return de.speicher.ducklake;
  return store ?? "—";
}

function abfrageLabel(query: string | undefined): string {
  if (query === "line_board") return de.abfragen.line_board;
  if (query === "shift_report") return de.abfragen.shift_report;
  if (query === "cell_dossier") return de.abfragen.cell_dossier;
  return query ?? "—";
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

function stationNio(cells: LineCell[], station: LineCell["station"]): LineCell[] {
  return cells
    .filter((cell) => cell.station === station && !cell.partOk)
    .slice()
    .sort((a, b) => +new Date(b.capturedAt) - +new Date(a.capturedAt));
}

function inspectionsNewestFirst(dossier: Dossier | null) {
  return [...(dossier?.inspections ?? [])].sort(
    (a, b) => +new Date(b.capturedAt) - +new Date(a.capturedAt),
  );
}

const DECISIONS = ["hold", "release", "scrap", "needs_line"] as const;
type Decision = (typeof DECISIONS)[number];

export function Floor() {
  const { dmc: routeDmc, id: caseId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sicht = params.get("sicht");
  const lens: Lens = isLens(sicht) ? sicht : "maschine";
  const tag = params.get("tag");
  const bericht: Bericht = isBericht(params.get("bericht")) ? params.get("bericht") : "voll";
  const nioOnly = params.get("nio") !== "0";
  const klassePick = params.get("klasse");
  const aktenFilter =
    params.get("akten") === "pinned" || params.get("akten") === "alle" ? params.get("akten") : "open";
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
  const [hunt, setHunt] = useState("");
  const [openCases, setOpenCases] = useState<CaseRecord[]>([]);
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.allSettled([
        api.linie(),
        api.chronik(),
        api.schicht(tag ?? undefined),
        api.schichtTage(),
        api.lake(),
        api.cases(aktenFilter === "alle" ? undefined : aktenFilter),
      ]).then((results) => {
          if (cancelled) return;
          const [linie, chronik, schicht, tage, lakeStatus, cases] = results;
          if (linie.status === "fulfilled") setBoard(linie.value);
          if (chronik.status === "fulfilled") setTape(chronik.value);
          if (schicht.status === "fulfilled") setShift(schicht.value);
          if (tage.status === "fulfilled") setDays(tage.value.days);
          if (lakeStatus.status === "fulfilled") setLake(lakeStatus.value);
          if (cases.status === "fulfilled") setOpenCases(cases.value.cases);
          const fail = results.find((item) => item.status === "rejected");
          if (fail && fail.status === "rejected") {
            const err = fail.reason;
            setError(err instanceof ApiError ? err.message : de.lakeDown);
          } else {
            setError(null);
          }
        });
    };
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tag, aktenFilter]);

  function patchParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function setOpt(key: string, value: string | null) {
    patchParams({ [key]: value });
  }

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

  const selectedCell = board ? latestCell(board.cells, selected) : null;
  const seeded = Boolean(board?.cells.length && board.cells.every((cell) => cell.source === "seed"));

  function pick(dmc: string) {
    setSelected(dmc);
    setTravelId("");
    setTravel(null);
    setTravelMissing(false);
    setAkteError(null);
    navigate({ pathname: `/zelle/${dmc}`, search: params.toString() });
  }

  function huntCell(event: FormEvent) {
    event.preventDefault();
    const q = hunt.trim();
    if (!q) return;
    const hit =
      board?.cells.find((cell) => cell.dmc === q) ??
      board?.cells.find((cell) => cell.dmc.toLowerCase().includes(q.toLowerCase()));
    pick(hit?.dmc ?? q);
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
        <form className="hunt" onSubmit={huntCell}>
          <label>
            {de.suche}
            <input
              value={hunt}
              onChange={(event) => setHunt(event.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
          </label>
          <button type="submit">{de.suchen}</button>
        </form>
        {board ? (
          <div className="bezel-readouts">
            <Lcd label={de.kpis.cells} value={formatCount(board.inspected)} />
            <Lcd label={de.kpis.nio} value={formatCount(board.nio)} warn={board.nio > 0} />
            <Lcd label={de.kpis.yield} value={formatPercent(board.yield)} warn={(board.yield ?? 1) < 0.8} />
            <Lcd label={de.kpis.takt} value={formatRate(board.taktPerHour)} />
            <Lcd label={de.kpis.snap} value={String(board.snapshotId)} />
            <Lcd label={de.kpis.clock} value={zurichClock(now)} />
            {board.stations.map((st) => (
              <Lcd
                key={st.station}
                label={de.stations[st.station]}
                value={formatPercent(st.nioRate)}
                warn={(st.nioRate ?? 0) > 0}
              />
            ))}
          </div>
        ) : null}
      </header>

      {error ? <div className="bezel-alert">{error}</div> : null}
      {seeded ? <div className="bezel-alert is-seed">{de.seed}</div> : null}

      <Zeitlinie timeline={board?.timeline} selected={selected} now={now} onPick={pick} />

      <div className="well">
        {board && board.inspected === 0 ? <Note>{de.empty}</Note> : null}
        <LensWell
          lens={lens}
          board={board}
          shift={shift}
          lake={lake}
          openCases={openCases}
          days={days}
          tag={tag}
          bericht={bericht}
          nioOnly={nioOnly}
          klassePick={klassePick}
          aktenFilter={aktenFilter}
          onOpt={setOpt}
          onPatch={patchParams}
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
          onPin={async () => {
            if (!akte) return;
            setAkteBusy(true);
            setAkteError(null);
            try {
              setAkte(
                await api.pinCase(akte.id, {
                  label: `${de.kpis.snap} ${board?.snapshotId ?? ""}`,
                  pinnedBy: "kaliber",
                }),
              );
              const next = await api.cases("open");
              setOpenCases(next.cases);
            } catch (err: unknown) {
              setAkteError(err instanceof ApiError ? err.message : de.lakeDown);
            } finally {
              setAkteBusy(false);
            }
          }}
          onDispose={async (decision) => {
            if (!akte) return;
            setAkteBusy(true);
            setAkteError(null);
            try {
              setAkte(
                await api.dispose(akte.id, {
                  decision,
                  note: `${de.entscheid[decision]} ${selected}`,
                  decidedBy: "kaliber",
                }),
              );
              const next = await api.cases("open");
              setOpenCases(next.cases);
            } catch (err: unknown) {
              setAkteError(err instanceof ApiError ? err.message : de.lakeDown);
            } finally {
              setAkteBusy(false);
            }
          }}
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
              const next = await api.cases("open");
              setOpenCases(next.cases);
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
      <footer className="provenance">
        <span>{de.quellen}</span>
        <span>{speicherLabel(board?._provenance.store)}</span>
        <span>{abfrageLabel(board?._provenance.query)}</span>
        <span>
          {de.kpis.snap} {board?.snapshotId ?? "—"}
        </span>
        <span>{zurichClock(now)}</span>
      </footer>
    </div>
  );
}

function LensWell({
  lens,
  board,
  shift,
  lake,
  openCases,
  days,
  tag,
  bericht,
  nioOnly,
  klassePick,
  aktenFilter,
  onOpt,
  onPatch,
  selected,
  travelId,
  onPick,
  onTravelId,
}: {
  lens: Lens;
  board: LineBoard | null;
  shift: ShiftReport | null;
  lake: LakeStatus | null;
  openCases: CaseRecord[];
  days: string[];
  tag: string | null;
  bericht: Bericht;
  nioOnly: boolean;
  klassePick: string | null;
  aktenFilter: string;
  onOpt: (key: string, value: string | null) => void;
  onPatch: (patch: Record<string, string | null>) => void;
  selected: string;
  travelId: string;
  onPick: (dmc: string) => void;
  onTravelId: (id: string) => void;
}) {
  switch (lens) {
    case "maschine":
      return <Maschine board={board} selected={selected} nioOnly={nioOnly} onOpt={onOpt} onPick={onPick} />;
    case "tablett":
      return <Tablett board={board} selected={selected} onPick={onPick} />;
    case "fach":
      return <Fach board={board} selected={selected} onPick={onPick} />;
    case "fenster":
      return <Fenster board={board} selected={selected} onPick={onPick} />;
    case "klasse":
      return <Klasse board={board} klassePick={klassePick} onOpt={onOpt} onPick={onPick} />;
    case "schicht":
      return (
        <Schicht
          shift={shift}
          openCases={openCases}
          days={days}
          tag={tag}
          bericht={bericht}
          aktenFilter={aktenFilter}
          selected={selected}
          onOpt={onOpt}
          onPatch={onPatch}
          onPick={onPick}
        />
      );
    case "see":
      return <See lake={lake} selected={selected} travelId={travelId} onTravelId={onTravelId} />;
    default: {
      const _never: never = lens;
      return _never;
    }
  }
}

function Zeitlinie({
  timeline,
  selected,
  now,
  onPick,
}: {
  timeline: LineBoard["timeline"] | undefined;
  selected: string;
  now: Date;
  onPick: (dmc: string) => void;
}) {
  const from = timeline?.from ?? now.toISOString();
  const to = timeline?.to ?? now.toISOString();
  const marks = (timeline?.events ?? []).map((event) => ({
    ...event,
    x: timelineOffset(event.at, from, to),
  }));
  const axis = timelineAxis(from, to);
  const nowX = timelineOffset(now, from, to);
  return (
    <section className="takt-strip" aria-label={de.takt}>
      <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.2em] text-mute">
        <span>{de.takt}</span>
        <span>{de.taktHint}</span>
      </div>
      <div className="zeitlinie">
        <div className="zeitlinie-rail">
          {marks.map((mark, index) => {
            const label = `${mark.dmc} ${mark.nio ? de.io.nio : de.io.io} ${formatWhen(mark.at)}`;
            return (
            <button
              key={`${mark.dmc}-${mark.at}-${index}`}
              type="button"
              aria-label={label}
              className={[
                mark.nio ? "is-nio" : "is-io",
                mark.dmc === selected ? "is-picked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${mark.x * 100}%` }}
              title={label}
              onClick={() => onPick(mark.dmc)}
            />
            );
          })}
          <span className="zeitlinie-now" style={{ left: `${nowX * 100}%` }}>
            {de.jetzt}
          </span>
        </div>
        <div className="zeitlinie-axis">
          {axis.map((tick) => (
            <span key={+tick.at} style={{ left: `${timelineOffset(tick.at, from, to) * 100}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Maschine({
  board,
  selected,
  nioOnly,
  onOpt,
  onPick,
}: {
  board: LineBoard | null;
  selected: string;
  nioOnly: boolean;
  onOpt: (key: string, value: string | null) => void;
  onPick: (dmc: string) => void;
}) {
  return (
    <section>
      <div className="bericht-head">
        <div>
          <h2>{de.lenses.maschine}</h2>
          <p className="lede">{de.maschineLede}</p>
        </div>
        <button
          type="button"
          className={`lens-opt ${nioOnly ? "is-on" : ""}`}
          aria-pressed={nioOnly}
          onClick={() => onOpt("nio", nioOnly ? "0" : null)}
        >
          {nioOnly ? de.nurNio : de.zuletzt}
        </button>
      </div>
      <ol className="stations">
        {(board?.stations ?? []).map((st) => {
          const nio = stationNio(board?.cells ?? [], st.station);
          const rows = nioOnly ? nio : st.last;
          return (
            <li key={st.station}>
              <header>
                <strong>{de.stations[st.station]}</strong>
                <span>{formatPercent(st.nioRate)}</span>
              </header>
              <div className="station-lcd">
                <Lcd label={de.kpis.cells} value={formatCount(st.inspected)} />
                <Lcd label={de.kpis.nio} value={formatCount(st.nio)} warn={st.nio > 0} />
              </div>
              <h3 className="subhead">{nioOnly ? de.alleNio : de.zuletzt}</h3>
              <ol className="last-cells">
                {rows.map((cell, index) => (
                  <li key={`${cell.dmc}-${cell.capturedAt}-${index}`}>
                    <CellRow cell={cell} selected={selected} onPick={onPick} />
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
                {row.cells.map((cell, index) => (
                  <li key={`${cell.dmc}-${cell.capturedAt}-${index}`}>
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
  shift,
  openCases,
  days,
  tag,
  bericht,
  aktenFilter,
  selected,
  onOpt,
  onPatch,
  onPick,
}: {
  shift: ShiftReport | null;
  openCases: CaseRecord[];
  days: string[];
  tag: string | null;
  bericht: Bericht;
  aktenFilter: string;
  selected: string;
  onOpt: (key: string, value: string | null) => void;
  onPatch: (patch: Record<string, string | null>) => void;
  onPick: (dmc: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const classes = DEFECT_CLASSES.map((cls) => ({
    defectClass: cls,
    count: shift?.defects.find((item) => item.defectClass === cls)?.count ?? 0,
  }));
  const nio = shift?.nioCells ?? [];
  const activeDay = tag ?? shift?.day ?? days[0] ?? null;
  const dayIndex = activeDay ? days.indexOf(activeDay) : -1;
  const show = (part: Bericht) => bericht === "voll" || bericht === part;
  return (
    <section className="bericht">
      <div className="bericht-head">
        <div>
          <h2>{de.bericht}</h2>
          <p className="lede">{de.schichtLede}</p>
        </div>
        <div className="bericht-actions no-print">
          <button type="button" onClick={() => window.print()}>
            {de.drucken}
          </button>
          <button
            type="button"
            disabled={!nio.length}
            onClick={() => {
              const text = nio
                .map((cell) => [cell.dmc, cell.defectClass ?? "", formatWhen(cell.capturedAt)].join("\t"))
                .join("\n");
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? de.kopiert : de.listeKopieren}
          </button>
        </div>
      </div>
      <div className="bericht-opts no-print">
        <button
          type="button"
          disabled={dayIndex < 0 || dayIndex >= days.length - 1}
          onClick={() => onOpt("tag", days[dayIndex + 1] ?? null)}
        >
          {de.tagVor}
        </button>
        <span className="mono">{activeDay ?? "—"}</span>
        <button
          type="button"
          disabled={dayIndex <= 0}
          onClick={() => onOpt("tag", dayIndex === 1 ? null : (days[dayIndex - 1] ?? null))}
        >
          {de.tagNach}
        </button>
        {BERICHTE.map((id) => (
          <button
            key={id}
            type="button"
            className={id === bericht ? "is-on" : undefined}
            onClick={() => onOpt("bericht", id === "voll" ? null : id)}
          >
            {de.berichtArt[id]}
          </button>
        ))}
        <button
          type="button"
          className={!tag && bericht === "voll" ? "is-on" : undefined}
          onClick={() => onPatch({ tag: null, bericht: null, akten: null })}
        >
          {de.see.current}
        </button>
      </div>
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
          {show("stunden") ? (
            <>
              <h3 className="subhead">{de.stunden}</h3>
              <table className="bericht-table">
                <thead>
                  <tr>
                    <th>{de.stunden}</th>
                    <th>{de.kpis.cells}</th>
                    <th>{de.kpis.nio}</th>
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => {
                    const row = shift.hours.find((item) => item.hour === hour);
                    return (
                      <tr key={hour}>
                        <td className="mono">{String(hour).padStart(2, "0")}</td>
                        <td className="mono">{formatCount(row?.inspected ?? 0)}</td>
                        <td className="mono">{formatCount(row?.nio ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : null}
          {show("maschine") ? (
            <>
              <h3 className="subhead">{de.lenses.maschine}</h3>
              <table className="bericht-table">
                <thead>
                  <tr>
                    <th>{de.lenses.maschine}</th>
                    <th>{de.kpis.cells}</th>
                    <th>{de.kpis.nio}</th>
                    <th>{de.kpis.yield}</th>
                  </tr>
                </thead>
                <tbody>
                  {shift.stations.map((st) => (
                    <tr key={st.station}>
                      <td>{de.stations[st.station]}</td>
                      <td className="mono">{formatCount(st.inspected)}</td>
                      <td className="mono">{formatCount(st.nio)}</td>
                      <td className="mono">{formatPercent(st.nioRate === null ? null : 1 - st.nioRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="subhead">{de.span.title}</h3>
              <div className="span-readouts">
                <Lcd label={de.span.min} value={fmtMm(shift.spanWindow.min)} />
                <Lcd label={de.span.p50} value={fmtMm(shift.spanWindow.p50)} />
                <Lcd
                  label={de.span.p95}
                  value={fmtMm(shift.spanWindow.p95)}
                  warn={(shift.spanWindow.p95 ?? 0) > SPAN_LIMIT}
                />
                <Lcd
                  label={de.span.max}
                  value={fmtMm(shift.spanWindow.max)}
                  warn={(shift.spanWindow.max ?? 0) > SPAN_LIMIT}
                />
              </div>
            </>
          ) : null}
          {show("klassen") ? (
            <>
              <h3 className="subhead">{de.klasse.title}</h3>
              <ol className="schicht-defects">
                {classes.map((item) => {
                  const hit = nio.find((cell) => cell.defectClass === item.defectClass);
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
          ) : null}
          {show("akten") ? (
            <>
              <h3 className="subhead">{de.aktenOffen}</h3>
              <div className="bericht-opts no-print">
                <button
                  type="button"
                  className={aktenFilter === "open" ? "is-on" : undefined}
                  onClick={() => onOpt("akten", null)}
                >
                  {de.aktenOffen}
                </button>
                <button
                  type="button"
                  className={aktenFilter === "pinned" ? "is-on" : undefined}
                  onClick={() => onOpt("akten", "pinned")}
                >
                  {de.aktenPin}
                </button>
                <button
                  type="button"
                  className={aktenFilter === "alle" ? "is-on" : undefined}
                  onClick={() => onOpt("akten", "alle")}
                >
                  {de.aktenAlle}
                </button>
              </div>
              {openCases.length ? (
                <ol className="akten">
                  {openCases.map((record) => (
                    <li key={record.id}>
                      <button type="button" onClick={() => onPick(record.dmc)}>
                        <span className="mono">{record.dmc}</span>
                        <span>
                          {de.akteNr} {record.id} · {akteStand(record.status)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="hint">{de.keineAkten}</p>
              )}
            </>
          ) : null}
          {show("nio") ? (
            <>
              <h3 className="subhead">{de.alleNio}</h3>
              <ol className="last-cells">
                {nio.map((cell, index) => (
                  <li key={`${cell.dmc}-${cell.capturedAt}-${index}`}>
                    <CellRow
                      cell={cell}
                      selected={selected}
                      onPick={onPick}
                      extra={cell.defectClass ? defectLabel(cell.defectClass) : undefined}
                    />
                  </li>
                ))}
              </ol>
            </>
          ) : null}
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
        {offenders.map((cell, index) => (
          <li key={`${cell.dmc}-${cell.capturedAt}-${index}`}>
            <CellRow cell={cell} selected={selected} onPick={onPick} extra={fmtMm(cell.spanMm)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Klasse({
  board,
  klassePick,
  onOpt,
  onPick,
}: {
  board: LineBoard | null;
  klassePick: string | null;
  onOpt: (key: string, value: string | null) => void;
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
  const visible = klassePick ? grid.filter((row) => row.cls === klassePick) : grid;
  const max = Math.max(1, ...grid.flatMap((row) => row.counts));
  return (
    <section>
      <div className="bericht-head">
        <div>
          <h2>{de.lenses.klasse}</h2>
          <p className="lede">{de.klasseLede}</p>
        </div>
        {klassePick ? (
          <button type="button" className="lens-opt is-on" onClick={() => onOpt("klasse", null)}>
            {de.klasseAlle}
          </button>
        ) : (
          <span className="hint">{de.klasseNur}</span>
        )}
      </div>
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
            {visible.map((row) => (
              <tr key={row.cls}>
                <th>
                  <button type="button" className="heat" onClick={() => onOpt("klasse", row.cls === klassePick ? null : row.cls)}>
                    {defectLabel(row.cls)}
                  </button>
                </th>
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
        {de.seeLede} {de.kpis.snap} #{lake?.currentSnapshotId ?? "—"} {de.see.current}.
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
  onPin,
  onDispose,
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
  onPin: () => Promise<void>;
  onDispose: (decision: Decision) => Promise<void>;
}) {
  if (!selected) return <p className="hint">{de.pick}</p>;
  const live = latestInspection(dossier);
  const shown = travelId ? (travelMissing ? null : latestInspection(travel)) : live;
  const spanMm = travel
    ? (shown?.measurements?.spanMm ?? null)
    : (selectedCell?.spanMm ?? shown?.measurements?.spanMm ?? null);
  const nio = shown ? !shown.partOk : Boolean(selectedCell && !selectedCell.partOk);
  const source = shown?.source ?? selectedCell?.source;
  const history = inspectionsNewestFirst(travelId && !travelMissing ? travel : dossier);
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
      {history.length ? (
        <>
          <h3 className="subhead">{de.historie}</h3>
          <ol className="historie">
            {history.map((row) => (
              <li key={row.inspectionId}>
                <span>{row.partOk ? de.io.io : de.io.nio}</span>
                <span>{stationName(row.station)}</span>
                <span className="mono">{formatWhen(row.capturedAt)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {akte ? (
        <p className="hint">
          {de.akteNr} {akte.id} · {akteStand(akte.status)}
          {akte.pins.length ? ` · ${akte.pins[akte.pins.length - 1]?.label}` : ""}
        </p>
      ) : null}
      {akteError ? <Note>{akteError}</Note> : null}
      <div className="coupon-actions">
        <button type="button" disabled={akteBusy} onClick={() => void onOpen()}>
          {akteBusy ? de.openingCase : de.openCase}
        </button>
        <button type="button" disabled={akteBusy || !akte} onClick={() => void onPin()}>
          {de.pin}
        </button>
        {DECISIONS.map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={akteBusy || !akte || akte.status === "closed"}
            onClick={() => void onDispose(decision)}
          >
            {de.entscheid[decision]}
          </button>
        ))}
      </div>
    </article>
  );
}
