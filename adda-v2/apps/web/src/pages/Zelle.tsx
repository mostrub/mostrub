import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Dossier } from "../lib/api.ts";
import { formatWhen, verdictLabel } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass, Panel, Stamp } from "../ui.tsx";

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
      <Panel title="Zelle" kicker="Dossier nach DMC">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/zellen/${query.trim()}`);
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
            Dossier öffnen
          </button>
        </form>
      </Panel>

      {error ? <EmptyNote>{error}</EmptyNote> : null}

      {dossier ? (
        <Panel title={dossier.dmc} kicker={`Snapshot ${dossier.snapshotId}`}>
          <div className="mb-4 flex gap-2">
            {dossier.openCases?.map((item) => (
              <Link key={item.id} className="underline" to={`/akten/${item.id}`}>
                Offene Akte
              </Link>
            ))}
            <button
              className={buttonClass}
              type="button"
              onClick={async () => {
                const opened = await api.openCase({
                  dmc: dossier.dmc,
                  title: `Prüfung ${dossier.dmc}`,
                  openedBy: "qg.meier",
                });
                navigate(`/akten/${opened.id}`);
              }}
            >
              {de.openCase}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th className="py-2">Zeit</th>
                <th>Station</th>
                <th>Befund</th>
                <th>Defekte</th>
                <th>Quelle</th>
              </tr>
            </thead>
            <tbody>
              {dossier.inspections.map((row) => (
                <tr key={row.inspectionId} className="border-b border-paper-edge">
                  <td className="py-2">{formatWhen(row.capturedAt)}</td>
                  <td>{row.station}</td>
                  <td>
                    <Stamp kind={row.partOk ? "IO" : "NIO"} />
                  </td>
                  <td>{row.findings.map((f) => f.defectClass).join(", ") || "—"}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
              {dossier.lineEvents.map((row) => (
                <tr key={row.eventId} className="border-b border-paper-edge">
                  <td className="py-2">{formatWhen(row.observedAt)}</td>
                  <td>linie</td>
                  <td>
                    <Stamp kind={verdictLabel(row.verdict)} />
                  </td>
                  <td>—</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </div>
  );
}
