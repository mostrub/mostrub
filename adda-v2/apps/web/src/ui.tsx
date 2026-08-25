import type { ReactNode } from "react";

export function Stamp({ kind }: { kind: "IO" | "NIO" | "OFFEN" }) {
  const tone =
    kind === "NIO"
      ? "border-nio text-nio"
      : kind === "IO"
        ? "border-io text-io"
        : "border-muted text-muted";
  return (
    <span className={`inline-flex border px-2 py-0.5 font-serif text-xs tracking-[0.18em] ${tone}`}>
      {kind}
    </span>
  );
}

export function Panel({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule bg-paper p-5 shadow-[4px_4px_0_0_rgba(27,23,19,0.08)]">
      {kicker ? (
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted">{kicker}</p>
      ) : null}
      <h2 className="mb-4 font-serif text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-rule px-4 py-6 text-muted">{children}</p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-[0.16em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink";
export const buttonClass =
  "border border-ink bg-ink px-3 py-2 text-sm text-paper hover:bg-transparent hover:text-ink";
