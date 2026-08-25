import type { ReactNode } from "react";

export function Stamp({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-20 border border-ink px-2 py-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <p className={`font-mono text-xl leading-none ${warn ? "text-nio" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export function Rule({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-rule px-3 py-4 text-sm text-mute">{children}</p>;
}
