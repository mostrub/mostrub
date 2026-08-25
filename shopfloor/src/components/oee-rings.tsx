import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatPct } from "@/lib/format"
import type { OeeParts } from "@/lib/oee"

const oeeConfig = {
  availability: { label: "Verfügbarkeit", color: "var(--chart-1)" },
  performance: { label: "Leistung", color: "var(--chart-3)" },
  quality: { label: "Qualität", color: "var(--chart-2)" },
} satisfies ChartConfig

export function OeeRings(args: { oee: OeeParts }) {
  const data = [
    {
      key: "quality",
      name: "Qualität",
      value: args.oee.quality,
      fill: "var(--color-quality)",
    },
    {
      key: "performance",
      name: "Leistung",
      value: args.oee.performance,
      fill: "var(--color-performance)",
    },
    {
      key: "availability",
      name: "Verfügbarkeit",
      value: args.oee.availability,
      fill: "var(--color-availability)",
    },
  ]
  return (
    <div className="relative">
      <ChartContainer config={oeeConfig} className="mx-auto h-56 w-full max-w-sm">
        <RadialBarChart
          data={data}
          innerRadius="28%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <RadialBar
            dataKey="value"
            background={{ fill: "var(--muted)" }}
            cornerRadius={4}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-muted-foreground">OEE</p>
        <p className="font-mono text-2xl">{formatPct(args.oee.oee)}</p>
      </div>
    </div>
  )
}
