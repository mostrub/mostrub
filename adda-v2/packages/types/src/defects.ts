export const DEFECT_CLASSES = [
  "Span",
  "Zink",
  "Kratzer",
  "Dichtungsbraue",
  "Abgeschabte_Dichtung",
  "Ausgezogene_Dichtung",
  "Elektrolyt_Flecken",
  "Nicht_geschlossen",
  "Paste",
  "Separator",
  "Verletzung_Becherrand",
] as const;

export type DefectClass = (typeof DEFECT_CLASSES)[number];

export function isDefectClass(value: string): value is DefectClass {
  return (DEFECT_CLASSES as readonly string[]).includes(value);
}
