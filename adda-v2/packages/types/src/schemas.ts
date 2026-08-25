import { z } from "zod";
import { parseDmc } from "./brands.ts";
import { DEFECT_CLASSES } from "./defects.ts";

export const stationSchema = z.enum(["anode", "cathode", "oqc"]);
export const verdictSchema = z.enum(["io", "nio", "unknown"]);
export const defectClassSchema = z.enum(DEFECT_CLASSES);
export const dispositionDecisionSchema = z.enum([
  "hold",
  "release",
  "scrap",
  "needs_line",
]);
export const caseStatusSchema = z.enum(["open", "pinned", "closed"]);

export const measurementSchema = z.object({
  phiDeg: z.number().finite(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  spanMm: z.number().nonnegative(),
});

export const findingSchema = z.object({
  defectClass: defectClassSchema,
  score: z.number().min(0).max(1),
});

export const inspectionIngestSchema = z.object({
  dmc: z.string().transform(parseDmc),
  capturedAt: z.string().datetime({ offset: true }),
  station: stationSchema,
  tray: z.string().min(1),
  slot: z.number().int().min(1),
  partOk: z.boolean(),
  source: z.enum(["valtr", "seed"]).default("valtr"),
  measurements: measurementSchema,
  findings: z.array(findingSchema).default([]),
});

export const lineEventIngestSchema = z.object({
  dmc: z.string().transform(parseDmc),
  observedAt: z.string().datetime({ offset: true }),
  verdict: verdictSchema,
  source: z.enum(["mqtt", "seed"]).default("mqtt"),
});

export const openCaseSchema = z.object({
  dmc: z.string().transform(parseDmc),
  title: z.string().min(1).max(200),
  openedBy: z.string().min(1).max(80),
});

export const dispositionSchema = z.object({
  decision: dispositionDecisionSchema,
  note: z.string().min(1).max(2000),
  decidedBy: z.string().min(1).max(80),
});

export const pinCaseSchema = z.object({
  label: z.string().min(1).max(120),
  pinnedBy: z.string().min(1).max(80),
});

export type Station = z.infer<typeof stationSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type InspectionIngest = z.infer<typeof inspectionIngestSchema>;
export type LineEventIngest = z.infer<typeof lineEventIngestSchema>;
export type OpenCaseInput = z.infer<typeof openCaseSchema>;
export type DispositionInput = z.infer<typeof dispositionSchema>;
export type PinCaseInput = z.infer<typeof pinCaseSchema>;
export type CaseStatus = z.infer<typeof caseStatusSchema>;
export type DispositionDecision = z.infer<typeof dispositionDecisionSchema>;
