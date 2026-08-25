import { newId as createId } from "@/lib/id"
import { appendHistory, diffFields } from "./history"
import { inventoryNumberTaken, nextInventoryNumber } from "./normalize"
import type {
  AssetKind,
  DestructionRecord,
  HistoryEvent,
  InventoryState,
  Laptop,
  Printer,
  SaveResult,
  SoftwareLicense,
} from "./types"

export function emptyInventory(): InventoryState {
  return {
    laptops: [],
    printers: [],
    software: [],
    destructions: [],
    history: [],
  }
}

function required(value: string, label: string): string | null {
  if (value.trim().length === 0) {
    return `${label} ist Pflicht`
  }
  return null
}

function normalizeAssetTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function normalizeInventoryNumber(value: string): string {
  return value.trim()
}

function hasDuplicateTag<T extends { id: string; assetTag: string }>(
  items: T[],
  record: T,
): boolean {
  const tag = normalizeAssetTag(record.assetTag)
  return items.some(
    (item) => item.id !== record.id && normalizeAssetTag(item.assetTag) === tag,
  )
}

function hasDuplicateSerial<T extends { id: string; serialNumber: string }>(
  items: T[],
  record: T,
): boolean {
  const serial = record.serialNumber.trim().toLowerCase()
  if (!serial) {
    return false
  }
  return items.some(
    (item) =>
      item.id !== record.id && item.serialNumber.trim().toLowerCase() === serial,
  )
}

function replaceById<T extends { id: string }>(items: T[], record: T): T[] {
  const index = items.findIndex((item) => item.id === record.id)
  if (index === -1) {
    return [...items, record]
  }
  return items.map((item) => (item.id === record.id ? record : item))
}

function withInventoryNumber<T extends { id: string; inventoryNumber: string }>(
  state: InventoryState,
  record: T,
): T | { error: string } {
  const inventoryNumber = record.inventoryNumber.trim()
    ? normalizeInventoryNumber(record.inventoryNumber)
    : nextInventoryNumber(state)
  if (inventoryNumberTaken(state, inventoryNumber, record.id)) {
    return { error: "Diese Inventarnummer ist schon vergeben" }
  }
  return { ...record, inventoryNumber }
}

type HardwareMatch =
  | { kind: "laptop"; id: string; item: Laptop }
  | { kind: "printer"; id: string; item: Printer }

function findHardwareByField(
  state: InventoryState,
  field: "assetTag" | "inventoryNumber",
  query: string,
  kind?: Exclude<AssetKind, "other">,
): HardwareMatch | null {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return null
  }

  const matches = (item: { assetTag: string; inventoryNumber: string }) =>
    field === "assetTag"
      ? normalizeAssetTag(item.assetTag) === needle
      : item.inventoryNumber.trim().toLowerCase() === needle

  if (kind !== "printer") {
    const laptop = state.laptops.find(matches)
    if (laptop) {
      return { kind: "laptop", id: laptop.id, item: laptop }
    }
  }
  if (kind !== "laptop") {
    const printer = state.printers.find(matches)
    if (printer) {
      return { kind: "printer", id: printer.id, item: printer }
    }
  }
  return null
}

function hasOpenDestruction(state: InventoryState, assetId: string): boolean {
  return state.destructions.some((record) => record.assetId === assetId)
}

function applyDestructionStatus<T extends { id: string; status: string }>(
  items: T[],
  linked: Set<string>,
): T[] {
  return items.map((item) => {
    if (linked.has(item.id)) {
      return { ...item, status: "destroyed" }
    }
    if (item.status === "destroyed") {
      return { ...item, status: "in-service" }
    }
    return item
  })
}

function syncDestroyedHardware(
  state: InventoryState,
  destructions: DestructionRecord[],
): Pick<InventoryState, "laptops" | "printers"> {
  const linked = new Set(
    destructions.map((record) => record.assetId).filter((id) => id.length > 0),
  )

  return {
    laptops: applyDestructionStatus(state.laptops, linked),
    printers: applyDestructionStatus(state.printers, linked),
  }
}

function blockLinkedDelete(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> | null {
  if (hasOpenDestruction(state, id)) {
    return {
      ok: false,
      error: "Zuerst den Vernichtungseintrag entfernen",
    }
  }
  return null
}

function syncLinkedDestructionIdentifiers(
  destructions: DestructionRecord[],
  assetId: string,
  identifiers: Pick<DestructionRecord, "inventoryNumber" | "assetTag" | "serialNumber">,
): DestructionRecord[] {
  return destructions.map((record) =>
    record.assetId === assetId
      ? {
          ...record,
          inventoryNumber: identifiers.inventoryNumber,
          assetTag: identifiers.assetTag,
          serialNumber: identifiers.serialNumber,
        }
      : record,
  )
}

function rejectDestroyedStatusConflict(
  state: InventoryState,
  id: string,
  status: string,
): SaveResult<InventoryState> | null {
  const linked = hasOpenDestruction(state, id)
  if (linked && status !== "destroyed") {
    return {
      ok: false,
      error: "Status folgt dem Vernichtungseintrag",
    }
  }
  if (!linked && status === "destroyed") {
    return {
      ok: false,
      error: "Vernichtung über das Vernichtungsregister erfassen",
    }
  }
  return null
}

export function upsertLaptop(
  state: InventoryState,
  laptop: Laptop,
): SaveResult<InventoryState> {
  const missing = required(laptop.assetTag, "Anlagenkennzeichen")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.laptops, laptop)) {
    return { ok: false, error: "Ein Laptop mit diesem Kennzeichen existiert schon" }
  }
  if (hasDuplicateSerial(state.laptops, laptop)) {
    return { ok: false, error: "Ein Laptop mit dieser Seriennummer existiert schon" }
  }
  const numbered = withInventoryNumber(state, laptop)
  if ("error" in numbered) {
    return { ok: false, error: numbered.error }
  }
  const statusConflict = rejectDestroyedStatusConflict(state, numbered.id, numbered.status)
  if (statusConflict) {
    return statusConflict
  }

  const previous = state.laptops.find((item) => item.id === numbered.id)
  const assetTag = numbered.assetTag.trim()
  const nextState = {
    ...state,
    laptops: replaceById(state.laptops, {
      ...numbered,
      assetTag,
    }),
    destructions: syncLinkedDestructionIdentifiers(state.destructions, numbered.id, {
      inventoryNumber: numbered.inventoryNumber,
      assetTag,
      serialNumber: numbered.serialNumber,
    }),
  }

  return {
    ok: true,
    state: appendHistory(nextState, laptopHistory(previous, numbered)),
  }
}

function laptopHistory(
  previous: Laptop | undefined,
  next: Laptop,
): Omit<HistoryEvent, "id" | "at"> {
  if (!previous) {
    return {
      action: "created",
      register: "laptop",
      recordId: next.id,
      inventoryNumber: next.inventoryNumber,
      assetTag: next.assetTag,
      serialNumber: next.serialNumber,
      summary: `Laptop ${next.inventoryNumber} angelegt (${next.assetTag.trim()})`,
      changes: [],
    }
  }
  const changes = diffFields(
    {
      inventoryNumber: previous.inventoryNumber,
      assetTag: previous.assetTag,
      serialNumber: previous.serialNumber,
      hostname: previous.hostname,
      assignedTo: previous.assignedTo,
      department: previous.department,
      location: previous.location,
      status: previous.status,
    },
    {
      inventoryNumber: next.inventoryNumber,
      assetTag: next.assetTag.trim(),
      serialNumber: next.serialNumber,
      hostname: next.hostname,
      assignedTo: next.assignedTo,
      department: next.department,
      location: next.location,
      status: next.status,
    },
  )
  return {
    action: "updated",
    register: "laptop",
    recordId: next.id,
    inventoryNumber: next.inventoryNumber,
    assetTag: next.assetTag.trim(),
    serialNumber: next.serialNumber,
    summary:
      changes.length > 0
        ? `Laptop ${next.inventoryNumber}: ${changes.map((item) => item.field).join(", ")} geändert`
        : `Laptop ${next.inventoryNumber} gespeichert`,
    changes,
  }
}

export function removeLaptop(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.laptops.find((laptop) => laptop.id === id)
  if (!item) {
    return { ok: true, state }
  }
  const blocked = blockLinkedDelete(state, id)
  if (blocked) {
    return blocked
  }
  const nextState = {
    ...state,
    laptops: state.laptops.filter((laptop) => laptop.id !== id),
  }
  return {
    ok: true,
    state: appendHistory(nextState, {
      action: "removed",
      register: "laptop",
      recordId: item.id,
      inventoryNumber: item.inventoryNumber,
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      summary: `Laptop ${item.inventoryNumber} aus dem Register entfernt`,
      changes: [],
    }),
  }
}

export function upsertPrinter(
  state: InventoryState,
  printer: Printer,
): SaveResult<InventoryState> {
  const missing = required(printer.assetTag, "Anlagenkennzeichen")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.printers, printer)) {
    return { ok: false, error: "Ein Drucker mit diesem Kennzeichen existiert schon" }
  }
  if (hasDuplicateSerial(state.printers, printer)) {
    return { ok: false, error: "Ein Drucker mit dieser Seriennummer existiert schon" }
  }
  const numbered = withInventoryNumber(state, printer)
  if ("error" in numbered) {
    return { ok: false, error: numbered.error }
  }
  const statusConflict = rejectDestroyedStatusConflict(state, numbered.id, numbered.status)
  if (statusConflict) {
    return statusConflict
  }

  const previous = state.printers.find((item) => item.id === numbered.id)
  const assetTag = numbered.assetTag.trim()
  const nextState = {
    ...state,
    printers: replaceById(state.printers, {
      ...numbered,
      assetTag,
    }),
    destructions: syncLinkedDestructionIdentifiers(state.destructions, numbered.id, {
      inventoryNumber: numbered.inventoryNumber,
      assetTag,
      serialNumber: numbered.serialNumber,
    }),
  }

  return {
    ok: true,
    state: appendHistory(nextState, {
      action: previous ? "updated" : "created",
      register: "printer",
      recordId: numbered.id,
      inventoryNumber: numbered.inventoryNumber,
      assetTag: numbered.assetTag.trim(),
      serialNumber: numbered.serialNumber,
      summary: previous
        ? `Drucker ${numbered.inventoryNumber} geändert`
        : `Drucker ${numbered.inventoryNumber} angelegt (${numbered.assetTag.trim()})`,
      changes: previous
        ? diffFields(
            {
              inventoryNumber: previous.inventoryNumber,
              assetTag: previous.assetTag,
              serialNumber: previous.serialNumber,
              location: previous.location,
              department: previous.department,
              status: previous.status,
              ipAddress: previous.ipAddress,
            },
            {
              inventoryNumber: numbered.inventoryNumber,
              assetTag: numbered.assetTag.trim(),
              serialNumber: numbered.serialNumber,
              location: numbered.location,
              department: numbered.department,
              status: numbered.status,
              ipAddress: numbered.ipAddress,
            },
          )
        : [],
    }),
  }
}

export function removePrinter(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.printers.find((printer) => printer.id === id)
  if (!item) {
    return { ok: true, state }
  }
  const blocked = blockLinkedDelete(state, id)
  if (blocked) {
    return blocked
  }
  const nextState = {
    ...state,
    printers: state.printers.filter((printer) => printer.id !== id),
  }
  return {
    ok: true,
    state: appendHistory(nextState, {
      action: "removed",
      register: "printer",
      recordId: item.id,
      inventoryNumber: item.inventoryNumber,
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      summary: `Drucker ${item.inventoryNumber} aus dem Register entfernt`,
      changes: [],
    }),
  }
}

export function upsertSoftware(
  state: InventoryState,
  license: SoftwareLicense,
): SaveResult<InventoryState> {
  const missing = required(license.name, "Softwarename")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (
    !Number.isFinite(license.seatsPurchased) ||
    !Number.isFinite(license.seatsAssigned) ||
    !Number.isFinite(license.annualCost)
  ) {
    return { ok: false, error: "Platz- und Kostenwerte müssen Zahlen sein" }
  }
  const numbered = withInventoryNumber(state, license)
  if ("error" in numbered) {
    return { ok: false, error: numbered.error }
  }

  const previous = state.software.find((item) => item.id === numbered.id)
  const nextState = {
    ...state,
    software: replaceById(state.software, numbered),
  }

  return {
    ok: true,
    state: appendHistory(nextState, {
      action: previous ? "updated" : "created",
      register: "software",
      recordId: numbered.id,
      inventoryNumber: numbered.inventoryNumber,
      assetTag: numbered.entitlementId || numbered.name,
      serialNumber: "",
      summary: previous
        ? `Software ${numbered.inventoryNumber} geändert`
        : `Software ${numbered.inventoryNumber} angelegt (${numbered.name})`,
      changes: previous
        ? diffFields(
            {
              inventoryNumber: previous.inventoryNumber,
              name: previous.name,
              seatsAssigned: previous.seatsAssigned,
              seatsPurchased: previous.seatsPurchased,
              department: previous.department,
              renewalDate: previous.renewalDate,
            },
            {
              inventoryNumber: numbered.inventoryNumber,
              name: numbered.name,
              seatsAssigned: numbered.seatsAssigned,
              seatsPurchased: numbered.seatsPurchased,
              department: numbered.department,
              renewalDate: numbered.renewalDate,
            },
          )
        : [],
    }),
  }
}

export function removeSoftware(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.software.find((license) => license.id === id)
  const nextState = {
    ...state,
    software: state.software.filter((license) => license.id !== id),
  }
  if (!item) {
    return { ok: true, state: nextState }
  }
  return {
    ok: true,
    state: appendHistory(nextState, {
      action: "removed",
      register: "software",
      recordId: item.id,
      inventoryNumber: item.inventoryNumber,
      assetTag: item.entitlementId || item.name,
      serialNumber: "",
      summary: `Software ${item.inventoryNumber} aus dem Register entfernt`,
      changes: [],
    }),
  }
}

export function recordDestruction(
  state: InventoryState,
  record: DestructionRecord,
): SaveResult<InventoryState> {
  const missing = required(
    record.assetTag.trim() || record.inventoryNumber.trim(),
    "Anlagenkennzeichen oder Inventarnummer",
  )
  if (missing) {
    return { ok: false, error: missing }
  }

  const previous = state.destructions.find((item) => item.id === record.id)
  const liveByTag = record.assetTag.trim()
    ? findHardwareByField(state, "assetTag", record.assetTag)
    : null
  const liveByNumber = record.inventoryNumber.trim()
    ? findHardwareByField(state, "inventoryNumber", record.inventoryNumber)
    : null
  if (record.assetKind === "other" && (liveByTag || liveByNumber)) {
    return {
      ok: false,
      error: "Dieses Kennzeichen ist noch im Register. Geräteart Laptop oder Drucker wählen.",
    }
  }
  const kind = record.assetKind === "other" ? undefined : record.assetKind
  const byTag =
    record.assetKind === "other" || !record.assetTag.trim()
      ? null
      : findHardwareByField(state, "assetTag", record.assetTag, kind)
  const byNumber =
    record.assetKind === "other" || !record.inventoryNumber.trim()
      ? null
      : findHardwareByField(state, "inventoryNumber", record.inventoryNumber, kind)
  if ((liveByTag || liveByNumber) && !byTag && !byNumber && record.assetKind !== "other") {
    return {
      ok: false,
      error: liveByTag?.kind === "laptop" || liveByNumber?.kind === "laptop"
        ? "Kennzeichen gehört zu einem Laptop"
        : "Kennzeichen gehört zu einem Drucker",
    }
  }
  if (byTag && byNumber && byTag.id !== byNumber.id) {
    return {
      ok: false,
      error: "Kennzeichen und Inventarnummer zeigen auf verschiedene Geräte",
    }
  }
  const match = byTag ?? byNumber
  if (
    match &&
    state.destructions.some(
      (item) => item.id !== record.id && item.assetId === match.id,
    )
  ) {
    return { ok: false, error: "Dieses Gerät ist schon vernichtet" }
  }
  const inventoryNumber =
    match?.item.inventoryNumber ||
    record.inventoryNumber.trim() ||
    nextInventoryNumber(state)
  if (inventoryNumberTaken(state, inventoryNumber, match?.id ?? record.id)) {
    return { ok: false, error: "Diese Inventarnummer ist schon vergeben" }
  }

  const nextRecord: DestructionRecord = {
    ...record,
    assetTag: (match?.item.assetTag ?? record.assetTag).trim(),
    assetId: match?.id ?? "",
    assetKind: match?.kind ?? record.assetKind,
    inventoryNumber,
    serialNumber: match?.item.serialNumber || record.serialNumber,
  }
  const destructions = replaceById(state.destructions, nextRecord)
  const hardware = syncDestroyedHardware(state, destructions)
  let nextState: InventoryState = {
    ...state,
    ...hardware,
    destructions,
  }

  if (previous && previous.assetId && previous.assetId !== nextRecord.assetId) {
    nextState = appendHistory(nextState, {
      action: "destruction-removed",
      register: "destruction",
      recordId: previous.id,
      inventoryNumber: previous.inventoryNumber,
      assetTag: previous.assetTag,
      serialNumber: previous.serialNumber,
      summary: `Vernichtungseintrag entfernt für ${previous.inventoryNumber || previous.assetTag}`,
      changes: [],
    })
  }

  if (!previous || previous.assetId !== nextRecord.assetId) {
    nextState = appendHistory(nextState, {
      action: "destroyed",
      register: "destruction",
      recordId: nextRecord.id,
      inventoryNumber: nextRecord.inventoryNumber,
      assetTag: nextRecord.assetTag,
      serialNumber: nextRecord.serialNumber,
      summary: `Vernichtung erfasst für ${nextRecord.inventoryNumber || nextRecord.assetTag}`,
      changes: [],
    })
  } else {
    nextState = appendHistory(nextState, {
      action: "updated",
      register: "destruction",
      recordId: nextRecord.id,
      inventoryNumber: nextRecord.inventoryNumber,
      assetTag: nextRecord.assetTag,
      serialNumber: nextRecord.serialNumber,
      summary: `Vernichtungseintrag ${nextRecord.inventoryNumber || nextRecord.assetTag} geändert`,
      changes: diffFields(
        {
          witnessedBy: previous.witnessedBy,
          certificateId: previous.certificateId,
          reason: previous.reason,
          notes: previous.notes,
          method: previous.method,
        },
        {
          witnessedBy: nextRecord.witnessedBy,
          certificateId: nextRecord.certificateId,
          reason: nextRecord.reason,
          notes: nextRecord.notes,
          method: nextRecord.method,
        },
      ),
    })
  }

  return { ok: true, state: nextState }
}

export function removeDestruction(
  state: InventoryState,
  id: string,
): SaveResult<InventoryState> {
  const item = state.destructions.find((record) => record.id === id)
  const destructions = state.destructions.filter((record) => record.id !== id)
  const hardware = syncDestroyedHardware(state, destructions)
  const nextState = {
    ...state,
    ...hardware,
    destructions,
  }
  if (!item) {
    return { ok: true, state: nextState }
  }
  return {
    ok: true,
    state: appendHistory(nextState, {
      action: "destruction-removed",
      register: "destruction",
      recordId: item.id,
      inventoryNumber: item.inventoryNumber,
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      summary: `Vernichtungseintrag entfernt für ${item.inventoryNumber || item.assetTag}`,
      changes: [],
    }),
  }
}

export function newId(): string {
  return createId()
}
