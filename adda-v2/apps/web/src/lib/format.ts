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

export function verdictLabel(value: string): "IO" | "NIO" | "OFFEN" {
  if (value === "io" || value === "IO") return "IO";
  if (value === "nio" || value === "NIO") return "NIO";
  return "OFFEN";
}
