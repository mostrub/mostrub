import type { ReactNode } from "react";

export function Lamp({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${on ? "bg-nio" : "bg-io"}`}
      aria-hidden
    />
  );
}

export function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`px-1.5 py-0.5 font-display text-sm tracking-wide ${
        ok ? "bg-io/15 text-io" : "bg-nio/15 text-nio"
      }`}
    >
      {label}
    </span>
  );
}

export function Hud({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-28 border border-line bg-panel px-3 py-2">
      <p className="font-display text-xs tracking-[0.2em] text-mist uppercase">{label}</p>
      <p className={`font-display text-3xl leading-none ${warn ? "text-nio" : "text-amber"}`}>
        {value}
      </p>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line px-4 py-6 text-mist">{children}</p>;
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
      <span className="font-display tracking-[0.16em] text-mist uppercase">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "border border-line bg-steel px-3 py-2 text-white outline-none focus:border-amber";
export const buttonClass =
  "border border-amber bg-amber px-3 py-2 font-display tracking-wide text-floor hover:bg-transparent hover:text-amber";
