import { useEffect, useState } from "react";
import { de } from "../i18n/de.ts";
import { api, ApiError, type ShiftReport } from "../lib/api.ts";
import { formatCount, formatPercent } from "../lib/format.ts";
import { EmptyNote, Hud } from "../ui.tsx";

export function SchichtPage() {
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .schicht()
      .then(setReport)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-6xl leading-none">SCHICHT</h1>
      {error ? <EmptyNote>{error}</EmptyNote> : null}
      {report && report.inspected === 0 ? <EmptyNote>{de.empty.schicht}</EmptyNote> : null}
      {report && report.inspected > 0 ? (
        <>
          <p className="text-xs text-mist">
            {report.from} → {report.to}
          </p>
          <div className="flex flex-wrap gap-2">
            <Hud label="Teile" value={formatCount(report.inspected)} />
            <Hud label="IO" value={formatCount(report.io)} />
            <Hud label="NIO" value={formatCount(report.nio)} warn />
            <Hud label="Ausbeute" value={formatPercent(report.yield)} />
          </div>
          <ul className="flex flex-col gap-2">
            {report.defects.map((item) => (
              <li key={item.defectClass}>
                <div className="mb-1 flex justify-between font-display text-lg">
                  <span>{item.defectClass.replaceAll("_", " ")}</span>
                  <span>{formatCount(item.count)}</span>
                </div>
                <div className="h-1.5 bg-steel">
                  <div
                    className="h-1.5 bg-amber"
                    style={{
                      width: `${Math.max(6, (item.count / report.inspected) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mist">
            {report._provenance.store} · snap {report._provenance.snapshotId}
          </p>
        </>
      ) : null}
    </div>
  );
}
