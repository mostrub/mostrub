import { useEffect, useState } from "react";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Dossier, type LakeStatus } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass, Panel, Stamp } from "../ui.tsx";

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
      <Panel
        title="See"
        kicker={status ? `aktueller Snapshot ${status.currentSnapshotId}` : "Lakehouse"}
      >
        {error ? <EmptyNote>{error}</EmptyNote> : null}
        {status && status.snapshots.length === 0 ? <EmptyNote>{de.empty.see}</EmptyNote> : null}
        {status ? (
          <p className="mb-4 text-sm text-muted">
            Schema {status.metadataSchema} · {status.lakePath}
          </p>
        ) : null}
        <ol className="flex max-h-80 flex-col gap-1 overflow-auto text-sm">
          {status?.snapshots
            .slice()
            .reverse()
            .map((snap) => (
              <li key={snap.snapshotId} className="border-b border-paper-edge py-2">
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() => setSnapshotId(String(snap.snapshotId))}
                >
                  #{snap.snapshotId} · {formatWhen(snap.snapshotTime)}
                </button>
                <span className="ml-2 text-muted">
                  {snap.author ?? "—"} {snap.commitMessage ?? ""}
                </span>
              </li>
            ))}
        </ol>
      </Panel>

      <Panel title="Zeitreise" kicker="Dossier auf einem Snapshot">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setTravel(await api.cellAt(Number(snapshotId), dmc));
          }}
        >
          <Field label="Snapshot">
            <input
              className={inputClass}
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
            />
          </Field>
          <Field label="DMC">
            <input
              className={`${inputClass} font-mono`}
              value={dmc}
              onChange={(e) => setDmc(e.target.value)}
            />
          </Field>
          <button className={buttonClass} type="submit">
            Lesen
          </button>
        </form>
        {travel ? (
          <div className="mt-4 text-sm">
            <p className="mb-2 font-mono">
              {travel.dmc} @ {travel.snapshotId}
            </p>
            {travel.inspections.map((row) => (
              <p key={row.inspectionId} className="flex items-center gap-2">
                <Stamp kind={row.partOk ? "IO" : "NIO"} />
                {formatWhen(row.capturedAt)} {row.findings.map((f) => f.defectClass).join(", ")}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
