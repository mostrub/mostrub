import { useEffect, useState } from "react";
import { de } from "../i18n/de.ts";
import { api, ApiError, type ShiftReport } from "../lib/api.ts";
import { formatCount, formatPercent } from "../lib/format.ts";
import { EmptyNote, Panel } from "../ui.tsx";

export function SchichtPage() {
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .schicht("2026-08-24T00:00:00+02:00", "2026-08-25T00:00:00+02:00")
      .then(setReport)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <Panel title="Schicht" kicker="Ausbeute 24.08.2026, Europe/Zurich">
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {report && report.inspected === 0 ? <EmptyNote>{de.empty.schicht}</EmptyNote> : null}
      {report && report.inspected > 0 ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Inspektionen" value={formatCount(report.inspected)} />
            <Stat label="IO" value={formatCount(report.io)} />
            <Stat label="NIO" value={formatCount(report.nio)} />
            <Stat label="Ausbeute" value={formatPercent(report.yield)} />
          </dl>
          <div>
            <h3 className="mb-3 font-serif text-lg">Defektmix</h3>
            <ul className="flex flex-col gap-2">
              {report.defects.map((item) => (
                <li key={item.defectClass}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.defectClass.replaceAll("_", " ")}</span>
                    <span>{formatCount(item.count)}</span>
                  </div>
                  <div className="h-2 bg-paper-edge">
                    <div
                      className="h-2 bg-nio"
                      style={{
                        width: `${Math.max(8, (item.count / report.inspected) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">
            {report._provenance.store} · {report._provenance.query} · Snapshot{" "}
            {report._provenance.snapshotId}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-rule p-3">
      <dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="font-serif text-3xl">{value}</dd>
    </div>
  );
}
