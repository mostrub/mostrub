import { useEffect, useState } from "react";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Dossier, type LakeStatus } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass, Pill } from "../ui.tsx";

export function SeePage() {
  const [status, setStatus] = useState<LakeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dmc, setDmc] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [travel, setTravel] = useState<Dossier | null>(null);

  useEffect(() => {
    api
      .lake()
      .then(setStatus)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-6xl leading-none">PIN</h1>
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {status ? (
        <p className="text-mist">aktuell #{status.currentSnapshotId}</p>
      ) : null}
      <ol className="max-h-72 overflow-auto border border-line bg-panel">
        {status?.snapshots
          .slice()
          .reverse()
          .map((snap) => (
            <li key={snap.snapshotId} className="border-b border-line px-3 py-2 text-sm">
              <button type="button" onClick={() => setSnapshotId(String(snap.snapshotId))}>
                #{snap.snapshotId} {formatWhen(snap.snapshotTime)} {snap.commitMessage ?? ""}
              </button>
            </li>
          ))}
      </ol>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setTravel(await api.cellAt(Number(snapshotId), dmc));
        }}
      >
        <Field label="Snapshot">
          <input className={inputClass} value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)} />
        </Field>
        <Field label="DMC">
          <input className={`${inputClass} font-mono`} value={dmc} onChange={(e) => setDmc(e.target.value)} />
        </Field>
        <button className={buttonClass} type="submit">
          Zeitreise
        </button>
      </form>
      {travel ? (
        <div className="border border-line bg-panel p-3">
          <p className="font-mono">
            {travel.dmc} @ {travel.snapshotId}
          </p>
          {travel.inspections.map((row) => (
            <p key={row.inspectionId} className="mt-2 flex items-center gap-2">
              <Pill ok={row.partOk} label={row.partOk ? "IO" : "NIO"} />
              {formatWhen(row.capturedAt)} {row.findings.map((f) => f.defectClass).join(" ")}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
