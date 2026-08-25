import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type CaseRecord } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass, Panel } from "../ui.tsx";

export function AktePage() {
  const { id } = useParams();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("Span bestätigt. Zelle ausgeschieden.");
  const [label, setLabel] = useState("Stand vor Nacharbeit");

  async function reload(nextId: string) {
    try {
      setRecord(await api.case(nextId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : de.lakeDown);
    }
  }

  useEffect(() => {
    if (id) void reload(id);
  }, [id]);

  if (error) return <EmptyNote>{error}</EmptyNote>;
  if (!record || !id) return <EmptyNote>Akte wird gelesen…</EmptyNote>;

  return (
    <div className="flex flex-col gap-5">
      <Panel title={record.title} kicker={`Akte ${record.id}`}>
        <p className="mb-3 text-sm text-muted">
          DMC{" "}
          <Link className="font-mono underline" to={`/zellen/${record.dmc}`}>
            {record.dmc}
          </Link>
          · {record.status} · {record.openedBy} · {formatWhen(record.openedAt)}
        </p>
        {record.snapshotId !== null ? (
          <p className="text-sm">Geheftet auf Snapshot {record.snapshotId}</p>
        ) : (
          <p className="text-sm text-muted">Noch kein Snapshot geheftet.</p>
        )}
      </Panel>

      <Panel title="Heften" kicker="DuckLake Snapshot">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setRecord(await api.pinCase(record.id, { label, pinnedBy: "qg.meier" }));
          }}
        >
          <Field label="Beschriftung">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <button className={buttonClass} type="submit">
            {de.pin}
          </button>
        </form>
      </Panel>

      <Panel title="Verfügungen" kicker="QG-Entscheid">
        <ul className="mb-4 flex flex-col gap-2 text-sm">
          {record.dispositions.map((item) => (
            <li key={item.id} className="border-b border-paper-edge pb-2">
              <strong>{item.decision}</strong> · {item.decidedBy} · {formatWhen(item.decidedAt)}
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setRecord(
              await api.dispose(record.id, {
                decision: "scrap",
                note,
                decidedBy: "qg.meier",
              }),
            );
          }}
        >
          <Field label="Notiz">
            <textarea
              className={inputClass}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button className={buttonClass} type="submit">
            {de.dispose} (scrap)
          </button>
        </form>
      </Panel>
    </div>
  );
}
