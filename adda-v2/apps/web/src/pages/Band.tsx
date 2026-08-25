import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type Chronik } from "../lib/api.ts";
import { formatWhen, verdictLabel } from "../lib/format.ts";
import { EmptyNote, Pill } from "../ui.tsx";

export function BandPage() {
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
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-6xl leading-none">BAND</h1>
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {data && data.events.length === 0 ? <EmptyNote>{de.empty.band}</EmptyNote> : null}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {data?.events.map((event, index) => (
          <Link
            key={`${event.dmc}-${event.at}-${index}`}
            to={`/zelle/${event.dmc}`}
            className="min-w-52 shrink-0 border border-line bg-panel p-3 hover:border-amber"
          >
            <p className="text-xs text-mist">{formatWhen(event.at)}</p>
            <p className="font-mono text-xs">{event.dmc}</p>
            <div className="mt-2 flex items-center justify-between">
              <Pill
                ok={verdictLabel(event.summary) === "IO"}
                label={verdictLabel(event.summary)}
              />
              <span className="text-xs text-mist">
                {event.kind === "inspection" ? "VIS" : "SPS"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
