import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { de } from "../i18n/de.ts";
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
import { Rule, Stamp } from "../ui.tsx";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const SPAN_LIMIT = 0.12;

export function Floor() {
  const { dmc: routeDmc, id: caseId } = useParams();
  const navigate = useNavigate();
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
  const defectMax = board?.defects[0]?.count ?? 1;

  return (
    <div className="flex min-h-screen flex-col gap-3 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-mute">{de.line}</p>
          <h1 className="text-4xl font-normal tracking-tight">{de.product}</h1>
        </div>
        {board ? (
          <div className="flex flex-wrap gap-2">
            <Stamp label="Teile" value={formatCount(board.inspected)} />
            <Stamp label="Ausbeute" value={formatPercent(board.yield)} warn={(board.yield ?? 1) < 0.8} />
            <Stamp label="NIO" value={formatCount(board.nio)} warn={board.nio > 0} />
            <Stamp
              label="Takt/h"
              value={board.taktPerHour === null ? "—" : formatCount(Math.round(board.taktPerHour))}
            />
            <Stamp
              label="Span Ø"
              value={board.spanWindow.mean === null ? "—" : board.spanWindow.mean.toFixed(3)}
              warn={(board.spanWindow.mean ?? 0) > SPAN_LIMIT}
            />
            <Stamp label="Snap" value={String(board.snapshotId)} />
          </div>
        ) : null}
      </header>

      {error ? <Rule>{error}</Rule> : null}
      {board && board.inspected === 0 ? <Rule>{de.empty}</Rule> : null}

      {board ? (
        <section>
          <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.2em] text-mute">
            <span>{de.takt}</span>
            <span>Europe/Zurich 00–23</span>
          </div>
          <div className="grid h-10 grid-cols-[repeat(24,minmax(0,1fr))] border border-ink">
            {HOURS.map((hour) => {
              const row = board.hours.find((item) => item.hour === hour);
              const inspected = row?.inspected ?? 0;
              const nio = row?.nio ?? 0;
              const fill = peakHour === 0 ? 0 : inspected / peakHour;
              return (
                <div
                  key={hour}
                  title={`${String(hour).padStart(2, "0")} · ${inspected} · ${nio} NIO`}
                  className="relative border-l border-rule/40 first:border-l-0"
                >
                  <div
                    className={`absolute inset-x-0 bottom-0 ${nio > 0 ? "bg-nio" : "bg-ink"}`}
                    style={{ height: `${Math.round(fill * 100)}%`, opacity: nio > 0 ? 0.85 : 0.28 }}
                  />
                  <span className="absolute bottom-0 left-0.5 text-[9px] text-mute">
                    {String(hour).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="flex flex-col gap-3">
          {board?.trays.map((tray) => (
            <article key={tray.tray} className="border border-ink bg-sheet p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm uppercase tracking-[0.22em]">
                  {de.tablett} {tray.tray}
                </h2>
                <p className="font-mono text-xs text-mute">
                  {tray.slots.reduce((sum, slot) => sum + slot.cells.filter((cell) => !cell.partOk).length, 0)} NIO
                </p>
              </div>
              <ol className="grid grid-cols-6 gap-1.5">
                {tray.slots.map((slot) => (
                  <li key={`${tray.tray}-${slot.slot}`}>
                    <SlotButton
                      slot={slot.slot}
                      cells={slot.cells}
                      selected={selected}
                      onSelect={(dmc) => {
                        setSelected(dmc);
                        navigate(`/zelle/${dmc}`);
                      }}
                    />
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {board?.stations ? (
            <div className="grid grid-cols-3 gap-2 text-xs">
              {board.stations.map((column) => (
                <p key={column.station} className="border border-ink px-2 py-1">
                  {de.stations[column.station]} · {formatCount(column.inspected)} · NIO{" "}
                  {formatPercent(column.nioRate)}
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-3 border border-ink bg-sheet p-3">
          {board ? <SpanRuler window={board.spanWindow} mark={selectedCell?.spanMm ?? null} /> : null}
          {board && board.defects.length > 0 ? (
            <div>
              <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-mute">{de.mischung}</h2>
              <ul className="flex flex-col gap-1">
                {board.defects.map((item) => (
                  <li key={item.defectClass} className="flex items-center gap-2">
                    <span className="w-28 truncate text-[11px]">
                      {item.defectClass.replaceAll("_", " ")}
                    </span>
                    <span className="h-2 flex-1 bg-paper">
                      <span
                        className="block h-2 bg-ink"
                        style={{ width: `${Math.max(8, (item.count / defectMax) * 100)}%` }}
                      />
                    </span>
                    <span className="font-mono text-[11px]">{formatCount(item.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {shift ? (
            <p className="text-[11px] text-mute">
              Schicht {formatCount(shift.io)} IO / {formatCount(shift.nio)} NIO
            </p>
          ) : null}
          {selected ? (
            <CellSheet
              dmc={selected}
              dossier={dossier}
              travel={travel}
              travelId={travelId}
              snapshots={lake?.snapshots ?? []}
              onTravelId={setTravelId}
              onTravel={setTravel}
              onOpened={(id) => navigate(`/akte/${id}`)}
            />
          ) : (
            <p className="text-sm text-mute">Ein Fach antippen.</p>
          )}
        </aside>
      </div>

      {tape ? (
        <section>
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-mute">{de.durchlauf}</div>
          <div className="flex h-8 overflow-hidden border border-ink">
            {tape.events.map((event, index) => {
              const ok = verdictLabel(event.summary) === "IO";
              return (
                <button
                  key={`${event.dmc}-${event.at}-${index}`}
                  type="button"
                  title={`${event.dmc} ${event.summary}`}
                  className={`h-full min-w-1.5 flex-1 border-l border-paper ${
                    ok ? "bg-ink/25" : "bg-nio"
                  } ${event.dmc === selected ? "outline outline-1 outline-ink" : ""}`}
                  onClick={() => {
                    setSelected(event.dmc);
                    navigate(`/zelle/${event.dmc}`);
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {board ? (
        <p className="text-[11px] text-mute">
          {board._provenance.store} · {board._provenance.query} · {formatWhen(new Date())} Europe/Zurich
        </p>
      ) : null}
    </div>
  );
}

function SlotButton({
  slot,
  cells,
  selected,
  onSelect,
}: {
  slot: number;
  cells: LineCell[];
  selected: string;
  onSelect: (dmc: string) => void;
}) {
  const latest = cells[cells.length - 1];
  const nio = cells.some((cell) => !cell.partOk);
  const active = cells.some((cell) => cell.dmc === selected);
  return (
    <button
      type="button"
      disabled={!latest}
      onClick={() => latest && onSelect(latest.dmc)}
      className={`flex aspect-square w-full flex-col items-start justify-between border p-1 text-left ${
        active ? "border-ink bg-mark" : nio ? "border-nio bg-nio text-sheet" : "border-ink bg-paper"
      }`}
    >
      <span className="font-mono text-[10px]">{String(slot).padStart(2, "0")}</span>
      <span className="w-full truncate font-mono text-[10px]">{latest?.dmc.slice(-4) ?? "·"}</span>
    </button>
  );
}

function SpanRuler({
  window,
  mark,
}: {
  window: LineBoard["spanWindow"];
  mark: number | null;
}) {
  const max = Math.max(window.max ?? SPAN_LIMIT, SPAN_LIMIT, mark ?? 0);
  const min = Math.min(window.min ?? 0, 0);
  const span = max - min || 1;
  const ticks = [
    { key: "min", value: window.min },
    { key: "p50", value: window.p50 },
    { key: "mean", value: window.mean },
    { key: "p95", value: window.p95 },
    { key: "max", value: window.max },
    { key: "lim", value: SPAN_LIMIT },
  ];
  return (
    <div>
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-mute">{de.fenster}</h2>
      <div className="relative h-28 border border-ink">
        <div
          className="absolute inset-y-0 border-l border-dashed border-nio"
          style={{ left: `${((SPAN_LIMIT - min) / span) * 100}%` }}
        />
        {ticks.map((tick) =>
          tick.value === null ? null : (
            <div
              key={tick.key}
              className="absolute top-0 h-full border-l border-ink/40"
              style={{ left: `${((tick.value - min) / span) * 100}%` }}
              title={`${tick.key} ${tick.value.toFixed(3)}`}
            />
          ),
        )}
        {mark !== null ? (
          <div
            className="absolute top-2 size-2 -translate-x-1/2 bg-nio"
            style={{ left: `${((mark - min) / span) * 100}%` }}
          />
        ) : null}
      </div>
      <p className="mt-1 font-mono text-[11px] text-mute">
        {fmt(window.min)} · p50 {fmt(window.p50)} · p95 {fmt(window.p95)} · {fmt(window.max)} · lim{" "}
        {SPAN_LIMIT.toFixed(3)}
      </p>
    </div>
  );
}

function fmt(value: number | null): string {
  return value === null ? "—" : value.toFixed(3);
}

function CellSheet({
  dmc,
  dossier,
  travel,
  travelId,
  snapshots,
  onTravelId,
  onTravel,
  onOpened,
}: {
  dmc: string;
  dossier: Dossier | null;
  travel: Dossier | null;
  travelId: string;
  snapshots: LakeStatus["snapshots"];
  onTravelId: (value: string) => void;
  onTravel: (value: Dossier | null) => void;
  onOpened: (id: string) => void;
}) {
  const latest = useMemo(() => dossier?.inspections[0], [dossier]);
  return (
    <div className="border-t border-ink pt-3">
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-mute">{de.zelle}</h2>
      <p className="font-mono text-sm">{dmc}</p>
      {latest ? (
        <p className="mt-1 text-xs">
          {latest.partOk ? "IO" : "NIO"} · {latest.station} ·{" "}
          {latest.findings.map((item) => item.defectClass.replaceAll("_", " ")).join(", ") || "—"}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="border border-ink bg-ink px-2 py-1 text-xs text-sheet"
          onClick={async () => {
            const opened = await api.openCase({
              dmc,
              title: `NIO ${dmc}`,
              openedBy: "linie",
            });
            onOpened(opened.id);
          }}
        >
          {de.openCase}
        </button>
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          onTravel(await api.cellAt(Number(travelId), dmc));
        }}
      >
        <label className="flex flex-col text-[11px] uppercase tracking-[0.16em] text-mute">
          Snap
          <select
            className="mt-1 border border-ink bg-paper px-1 py-1 font-mono text-xs text-ink"
            value={travelId}
            onChange={(event) => onTravelId(event.target.value)}
          >
            <option value="">—</option>
            {snapshots
              .slice()
              .reverse()
              .map((snap) => (
                <option key={snap.snapshotId} value={String(snap.snapshotId)}>
                  #{snap.snapshotId}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="border border-ink px-2 py-1 text-xs">
          {de.zeitreise}
        </button>
      </form>
      {travel ? (
        <p className="mt-2 text-xs">
          @{travel.snapshotId} · {travel.inspections[0]?.partOk ? "IO" : "NIO"} ·{" "}
          {travel.inspections[0]?.findings.map((item) => item.defectClass).join(" ") || "—"}
        </p>
      ) : null}
    </div>
  );
}
