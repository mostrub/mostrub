const zurich: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Zurich",
};

export function formatCount(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(Math.round(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return `${sign}${grouped}`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const tenths = Math.round(value * 1000) / 10;
  const [whole, frac = "0"] = tenths.toFixed(1).split(".");
  const grouped = formatCount(Number(whole));
  return `${grouped},${frac} %`;
}

export function formatWhen(value: string | Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    ...zurich,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function formatDay(value: string | Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    ...zurich,
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatRate(value: number | null): string {
  if (value === null) return "—";
  const tenths = Math.round(value * 10) / 10;
  const [whole, frac = "0"] = tenths.toFixed(1).split(".");
  return `${formatCount(Number(whole))},${frac}`;
}

export function timelineOffset(at: string | Date, from: string | Date, to: string | Date): number {
  const start = +new Date(from);
  const end = +new Date(to);
  const stamp = +new Date(at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(stamp) || end <= start) {
    return 0;
  }
  return Math.min(1, Math.max(0, (stamp - start) / (end - start)));
}

export function timelineAxis(from: string | Date, to: string | Date): { at: Date; label: string }[] {
  const start = +new Date(from);
  const end = +new Date(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [{ at: new Date(from), label: formatWhen(from) }];
  }
  const span = end - start;
  const steps = [
    30_000, 60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000, 3 * 3600_000,
    6 * 3600_000, 12 * 3600_000, 24 * 3600_000,
  ];
  const step = steps.find((ms) => span / ms <= 7) ?? 24 * 3600_000;
  const ticks: { at: Date; label: string }[] = [];
  for (let stamp = start; stamp <= end + 1; stamp += step) {
    const at = new Date(stamp);
    ticks.push({
      at,
      label: span < 2 * 3600_000 ? formatClock(at) : formatWhen(at),
    });
  }
  return ticks;
}

function formatClock(value: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    ...zurich,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export function verdictLabel(value: string): "IO" | "NIO" | "OFFEN" {
  if (value === "io" || value === "IO") return "IO";
  if (value === "nio" || value === "NIO") return "NIO";
  return "OFFEN";
}
