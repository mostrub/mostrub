import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type CaseRecord, type Chronik } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { buttonClass, EmptyNote, Panel, Stamp } from "../ui.tsx";

export function BankPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<{ dmc: string; at: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.chronik(), api.cases()])
      .then(([chronik, cases]) => {
        setQueue(nioWithoutClosedCase(chronik, cases.cases));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <Panel title="Bank" kicker="NIO ohne geschlossene Akte">
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {queue.length === 0 && !error ? (
        <EmptyNote>Keine offenen NIO-Zellen in der Chronik.</EmptyNote>
      ) : null}
      <ul className="flex flex-col gap-3">
        {queue.map((item) => (
          <li
            key={item.dmc}
            className="flex items-center justify-between gap-3 border-b border-paper-edge py-2"
          >
            <Stamp kind="NIO" />
            <Link className="font-mono underline" to={`/zellen/${item.dmc}`}>
              {item.dmc}
            </Link>
            <span className="text-sm text-muted">{formatWhen(item.at)}</span>
            <button
              className={buttonClass}
              type="button"
              onClick={async () => {
                const opened = await api.openCase({
                  dmc: item.dmc,
                  title: `NIO ${item.dmc}`,
                  openedBy: "qg.meier",
                });
                navigate(`/akten/${opened.id}`);
              }}
            >
              {de.openCase}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function nioWithoutClosedCase(
  chronik: Chronik,
  cases: CaseRecord[],
): { dmc: string; at: string }[] {
  const closed = new Set(
    cases.filter((item) => item.status === "closed").map((item) => item.dmc),
  );
  const seen = new Set<string>();
  const queue: { dmc: string; at: string }[] = [];
  for (const event of chronik.events) {
    if (event.summary !== "NIO" || closed.has(event.dmc) || seen.has(event.dmc)) {
      continue;
    }
    seen.add(event.dmc);
    queue.push({ dmc: event.dmc, at: event.at });
  }
  return queue;
}
