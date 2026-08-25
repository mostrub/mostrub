export type OeeParts = {
  availability: number
  performance: number
  quality: number
  oee: number
}

export const OEE_LOSS_KEYS = ["availability", "performance", "quality"] as const
export type OeeLossKey = (typeof OEE_LOSS_KEYS)[number]

export type OeeLoss = {
  key: OeeLossKey
  label: string
  minutes: number
}

export function computeOee(args: {
  windowMs: number
  unplannedDowntimeMs: number
  units: number
  goodUnits: number
  targetCycleMs: number
  idealMs?: number
}): OeeParts {
  const runMs = Math.max(args.windowMs - args.unplannedDowntimeMs, 0)
  const availability =
    args.windowMs <= 0 ? 0 : (100 * runMs) / args.windowMs
  const idealMs = args.idealMs ?? args.targetCycleMs * args.units
  const rawPerformance = runMs <= 0 || idealMs <= 0 ? 0 : (100 * idealMs) / runMs
  const performance = Math.min(rawPerformance, 100)
  const quality = args.units <= 0 ? 0 : (100 * args.goodUnits) / args.units
  return {
    availability,
    performance,
    quality,
    oee: (availability * performance * quality) / 10_000,
  }
}

export function oeeLossMinutes(args: {
  windowMs: number
  unplannedDowntimeMs: number
  idealMs: number
  quality: number
}): OeeLoss[] {
  const runMs = Math.max(args.windowMs - args.unplannedDowntimeMs, 0)
  const availabilityMs = Math.max(args.unplannedDowntimeMs, 0)
  const performanceMs = Math.max(runMs - Math.max(args.idealMs, 0), 0)
  const qualityMs = Math.max(args.idealMs, 0) * Math.max(0, 1 - args.quality / 100)
  return [
    {
      key: "availability",
      label: "Verfügbarkeit",
      minutes: availabilityMs / 60_000,
    },
    {
      key: "performance",
      label: "Leistung",
      minutes: performanceMs / 60_000,
    },
    {
      key: "quality",
      label: "Qualität",
      minutes: qualityMs / 60_000,
    },
  ]
}
