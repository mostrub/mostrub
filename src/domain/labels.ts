import type {
  AssetKind,
  AssetStatus,
  Department,
  DestructionMethod,
  FindingCode,
  LaptopType,
  LicenseType,
  OperatingSystem,
  PrinterType,
} from "./types"

export const DEPARTMENT_LABELS = {
  operations: "Betrieb",
  maintenance: "Instandhaltung",
  engineering: "Konstruktion",
  quality: "Qualität",
  safety: "Arbeitssicherheit",
  it: "IT",
  finance: "Finanzen",
  hr: "Personal",
  warehouse: "Lager",
  production: "Fertigung",
  "ot-controls": "OT / Leittechnik",
  contractor: "Fremdfirma",
} as const satisfies Record<Department, string>

export const LAPTOP_TYPE_LABELS = {
  standard: "Standard",
  engineering: "Konstruktionsarbeitsplatz",
  "field-rugged": "Feld / robust",
  executive: "Führungskraft",
  "shared-kiosk": "Gemeinschaft / Kiosk",
  "contractor-loaner": "Leihgerät Fremdfirma",
} as const satisfies Record<LaptopType, string>

export const OS_LABELS = {
  "windows-11": "Windows 11",
  "windows-10": "Windows 10",
  macos: "macOS",
  ubuntu: "Ubuntu",
  rhel: "RHEL",
} as const satisfies Record<OperatingSystem, string>

export const STATUS_LABELS = {
  "in-service": "Im Einsatz",
  spare: "Reserve",
  repair: "Reparatur",
  lost: "Verloren",
  retired: "Ausgemustert",
  destroyed: "Vernichtet",
} as const satisfies Record<AssetStatus, string>

export const PRINTER_TYPE_LABELS = {
  laser: "Laser",
  inkjet: "Tinte",
  label: "Etikett",
  mfp: "Multifunktion",
  plotter: "Plotter",
} as const satisfies Record<PrinterType, string>

export const LICENSE_TYPE_LABELS = {
  "per-seat": "Pro Platz",
  site: "Standortlizenz",
  subscription: "Abo",
  oem: "OEM",
  freeware: "Freeware",
} as const satisfies Record<LicenseType, string>

export const DESTRUCTION_METHOD_LABELS = {
  "secure-wipe-recycle": "Sicheres Löschen + Recycling",
  "physical-shred": "Physische Schredderung",
  degauss: "Entmagnetisieren",
  "return-to-vendor": "Rückgabe an Lieferant",
} as const satisfies Record<DestructionMethod, string>

export const ASSET_KIND_LABELS = {
  laptop: "Laptop",
  printer: "Drucker",
  other: "Sonstiges",
} as const satisfies Record<AssetKind, string>

export const FINDING_LABELS = {
  "missing-serial": "Seriennummer fehlt",
  "expired-warranty": "Garantie abgelaufen",
  "unassigned-in-service": "Im Einsatz ohne Zuweisung",
  "license-over-assigned": "Lizenz überbelegt",
  "license-expiring": "Lizenz läuft bald ab",
  "license-expired": "Lizenz abgelaufen",
  "destroy-without-witness": "Vernichtung ohne Zeugen",
} as const satisfies Record<FindingCode, string>

export function optionList<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }))
}
