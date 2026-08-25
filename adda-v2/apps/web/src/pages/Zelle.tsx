import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Dossier } from "../lib/api.ts";
import { formatWhen, verdictLabel } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass, Pill } from "../ui.tsx";

export function ZellePage() {
  const { dmc = "" } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(dmc);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dmc) return;
    api
      .cell(dmc)
      .then(setDossier)
      .catch((err: unknown) => {
        setDossier(null);
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, [dmc]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-6xl leading-none">ZELLE</h1>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/zelle/${query.trim()}`);
        }}
      >
        <Field label="DMC">
          <input
            className={`${inputClass} font-mono`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HLL2-20260824-0001"
          />
        </Field>
        <button className={buttonClass} type="submit">
          Laden
        </button>
      </form>
      {!dmc ? <EmptyNote>{de.empty.zelle}</EmptyNote> : null}
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {dossier ? (
        <section className="border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="font-mono">{dossier.dmc}</p>
            <p className="text-xs text-mist">snap {dossier.snapshotId}</p>
          </div>
          <button
            className={`${buttonClass} m-3`}
            type="button"
            onClick={async () => {
              const opened = await api.openCase({
                dmc: dossier.dmc,
                title: `NIO ${dossier.dmc}`,
                openedBy: "linie",
              });
              navigate(`/akte/${opened.id}`);
            }}
          >
            {de.openCase}
          </button>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-mist">
                <th className="px-3 py-2">Zeit</th>
                <th>Station</th>
                <th>IO</th>
                <th>Defekt</th>
                <th>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {dossier.inspections.map((row) => (
                <tr key={row.inspectionId} className="border-b border-line">
                  <td className="px-3 py-2">{formatWhen(row.capturedAt)}</td>
                  <td>{row.station}</td>
                  <td>
                    <Pill ok={row.partOk} label={row.partOk ? "IO" : "NIO"} />
                  </td>
                  <td>{row.findings.map((f) => f.defectClass).join(", ") || "—"}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
              {dossier.lineEvents.map((row) => (
                <tr key={row.eventId} className="border-b border-line">
                  <td className="px-3 py-2">{formatWhen(row.observedAt)}</td>
                  <td>SPS</td>
                  <td>
                    <Pill
                      ok={verdictLabel(row.verdict) === "IO"}
                      label={verdictLabel(row.verdict)}
                    />
                  </td>
                  <td>—</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
