import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { de } from "../i18n/de.ts";
import { api, ApiError, type CaseRecord } from "../lib/api.ts";
import { formatWhen } from "../lib/format.ts";
import { buttonClass, EmptyNote, Field, inputClass } from "../ui.tsx";

export function AktePage() {
  const { id } = useParams();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("NIO bestätigt.");
  const [label, setLabel] = useState("Linie jetzt");

  useEffect(() => {
    if (!id) return;
    api
      .case(id)
      .then(setRecord)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : de.lakeDown);
      });
  }, [id]);

  if (error) return <EmptyNote>{error}</EmptyNote>;
  if (!record) return <EmptyNote>Akte…</EmptyNote>;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-6xl leading-none">AKTE</h1>
      <p className="text-mist">
        <Link className="text-amber" to={`/zelle/${record.dmc}`}>
          {record.dmc}
        </Link>{" "}
        · {record.status} · {formatWhen(record.openedAt)}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setRecord(await api.pinCase(record.id, { label, pinnedBy: "linie" }));
        }}
      >
        <Field label="Pin">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <button className={buttonClass} type="submit">
          {de.pin}
        </button>
      </form>
      <ul className="text-sm">
        {record.dispositions.map((item) => (
          <li key={item.id} className="border-b border-line py-2">
            {item.decision} · {item.decidedBy} · {item.note}
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
              decidedBy: "linie",
            }),
          );
        }}
      >
        <Field label="Notiz">
          <textarea className={inputClass} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className={buttonClass} type="submit">
          {de.dispose} scrap
        </button>
      </form>
    </div>
  );
}
