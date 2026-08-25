import type { ReactNode } from "react";

export function Lcd({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`lcd min-w-24 px-2.5 py-1.5 ${warn ? "lcd-warn" : ""}`} aria-live={warn ? "polite" : undefined}>
      <p className="text-[9px] uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="font-mono text-2xl leading-none">{value}</p>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="border border-bezel bg-face px-3 py-3 text-sm text-mute">{children}</p>;
}
