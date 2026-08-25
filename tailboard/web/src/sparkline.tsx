import type { Sample } from "./types";

type Props = {
  samples: Sample[];
  width?: number;
  height?: number;
};

export function Sparkline({ samples, width = 160, height = 36 }: Props) {
  if (samples.length < 2) {
    return <svg className="spark" width={width} height={height} aria-hidden="true" />;
  }
  const ys = samples.map((s) => {
    if (!s.online) {
      return 0;
    }
    if (s.latencyMs == null) {
      return 70;
    }
    return Math.max(8, 100 - Math.min(s.latencyMs, 220) / 2.2);
  });
  const max = 100;
  const step = width / (ys.length - 1);
  const d = ys
    .map((y, i) => {
      const x = i * step;
      const py = height - (y / max) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const last = samples[samples.length - 1];
  const tone = last && last.online ? "var(--ok)" : "var(--alarm)";
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={tone} strokeWidth="2" />
    </svg>
  );
}
