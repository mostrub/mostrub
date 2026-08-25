export type OeeParts = {
  availability: number
  performance: number
  quality: number
  oee: number
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
