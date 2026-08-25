import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type CaseRecord } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { EmptyNote, Panel } from "../ui.tsx";

export function AktenPage() {
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .cases()
      .then((body) => setCases(body.cases))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <Panel title="Akten" kicker="Offene und geschlossene Fälle">
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {cases && cases.length === 0 ? <EmptyNote>{de.empty.akten}</EmptyNote> : null}
      {cases && cases.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-[0.14em] text-muted">
              <th className="py-2">Status</th>
              <th>DMC</th>
              <th>Titel</th>
              <th>Geöffnet</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.id} className="border-b border-paper-edge">
                <td className="py-3">{statusLabel(item.status)}</td>
                <td className="font-mono">
                  <Link className="underline decoration-rule" to={`/akten/${item.id}`}>
                    {item.dmc}
                  </Link>
                </td>
                <td>{item.title}</td>
                <td>{formatWhen(item.openedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Panel>
  );
}

function statusLabel(status: CaseRecord["status"]): string {
  switch (status) {
    case "open":
      return "offen";
    case "pinned":
      return "geheftet";
    case "closed":
      return "geschlossen";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
