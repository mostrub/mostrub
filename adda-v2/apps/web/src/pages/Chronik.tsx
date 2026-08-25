import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Chronik } from "../lib/api.ts";
import { formatWhen, verdictLabel } from "../lib/format.ts";
import { EmptyNote, Panel, Stamp } from "../ui.tsx";

export function ChronikPage() {
  const [data, setData] = useState<Chronik | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .chronik()
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <Panel title="Chronik" kicker={data ? `Snapshot ${data.snapshotId}` : "Evidenzstrom"}>
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {data && data.events.length === 0 ? <EmptyNote>{de.empty.chronik}</EmptyNote> : null}
      {data && data.events.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {data.events.map((event, index) => (
            <li
              key={`${event.dmc}-${event.at}-${index}`}
              className="flex items-center justify-between gap-4 border-b border-paper-edge py-2 text-sm"
            >
              <span className="text-muted">{formatWhen(event.at)}</span>
              <Link className="font-mono underline" to={`/zellen/${event.dmc}`}>
                {event.dmc}
              </Link>
              <span>{event.kind === "inspection" ? "Inspektion" : "Linie"}</span>
              <Stamp kind={verdictLabel(event.summary)} />
              <span className="text-muted">{event.source}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}
