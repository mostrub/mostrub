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
    return `${label} is required`
  }
  return null
}

export function normalizeAssetTag(tag: string): string {
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
    return { error: "That inventory number is already in use" }
  }
  return { ...record, inventoryNumber }
}

export function findHardwareByTag(
  state: InventoryState,
  tag: string,
): { kind: Exclude<AssetKind, "other">; id: string } | null {
  const match = findHardware(state, tag)
  return match ? { kind: match.kind, id: match.id } : null
}

export function findHardware(
  state: InventoryState,
  query: string,
):
  | { kind: "laptop"; id: string; item: Laptop }
  | { kind: "printer"; id: string; item: Printer }
  | null {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return null
  }

  const laptop = state.laptops.find(
    (item) =>
      normalizeAssetTag(item.assetTag) === needle ||
      item.inventoryNumber.trim().toLowerCase() === needle,
  )
  if (laptop) {
    return { kind: "laptop", id: laptop.id, item: laptop }
  }

  const printer = state.printers.find(
    (item) =>
      normalizeAssetTag(item.assetTag) === needle ||
      item.inventoryNumber.trim().toLowerCase() === needle,
  )
  if (printer) {
    return { kind: "printer", id: printer.id, item: printer }
  }

  return null
}

function syncDestroyedHardware(
  state: InventoryState,
  destructions: DestructionRecord[],
): Pick<InventoryState, "laptops" | "printers"> {
  const linked = new Set(
    destructions.map((record) => record.assetId).filter((id) => id.length > 0),
  )

  return {
    laptops: state.laptops.map((item) => {
      if (linked.has(item.id)) {
        return { ...item, status: "destroyed" }
      }
      if (item.status === "destroyed") {
        return { ...item, status: "in-service" }
      }
      return item
    }),
    printers: state.printers.map((item) => {
      if (linked.has(item.id)) {
        return { ...item, status: "destroyed" }
      }
      if (item.status === "destroyed") {
        return { ...item, status: "in-service" }
      }
      return item
    }),
  }
}

function blockDestroyedDelete(status: string): SaveResult<InventoryState> | null {
  if (status === "destroyed") {
    return {
      ok: false,
      error: "Remove the destruction log first",
    }
  }
  return null
}

export function upsertLaptop(
  state: InventoryState,
  laptop: Laptop,
): SaveResult<InventoryState> {
  const missing = required(laptop.assetTag, "Asset tag")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.laptops, laptop)) {
    return { ok: false, error: "A laptop with this asset tag already exists" }
  }
  if (hasDuplicateSerial(state.laptops, laptop)) {
    return { ok: false, error: "A laptop with this serial already exists" }
  }
  const numbered = withInventoryNumber(state, laptop)
  if ("error" in numbered) {
    return { ok: false, error: numbered.error }
  }

  const previous = state.laptops.find((item) => item.id === numbered.id)
  const nextState = {
    ...state,
    laptops: replaceById(state.laptops, {
      ...numbered,
      assetTag: numbered.assetTag.trim(),
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
      summary: `Laptop ${next.inventoryNumber} added (${next.assetTag.trim()})`,
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
        ? `Laptop ${next.inventoryNumber}: ${changes.map((item) => item.field).join(", ")} changed`
        : `Laptop ${next.inventoryNumber} saved`,
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
  const blocked = blockDestroyedDelete(item.status)
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
      summary: `Laptop ${item.inventoryNumber} removed from the register`,
      changes: [],
    }),
  }
}

export function upsertPrinter(
  state: InventoryState,
  printer: Printer,
): SaveResult<InventoryState> {
  const missing = required(printer.assetTag, "Asset tag")
  if (missing) {
    return { ok: false, error: missing }
  }
  if (hasDuplicateTag(state.printers, printer)) {
    return { ok: false, error: "A printer with this asset tag already exists" }
  }
  if (hasDuplicateSerial(state.printers, printer)) {
    return { ok: false, error: "A printer with this serial already exists" }
  }
  const numbered = withInventoryNumber(state, printer)
  if ("error" in numbered) {
    return { ok: false, error: numbered.error }
  }

  const previous = state.printers.find((item) => item.id === numbered.id)
  const nextState = {
    ...state,
    printers: replaceById(state.printers, {
      ...numbered,
      assetTag: numbered.assetTag.trim(),
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
        ? `Printer ${numbered.inventoryNumber} updated`
        : `Printer ${numbered.inventoryNumber} added (${numbered.assetTag.trim()})`,
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
  const blocked = blockDestroyedDelete(item.status)
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
      summary: `Printer ${item.inventoryNumber} removed from the register`,
      changes: [],
    }),
  }
}

export function upsertSoftware(
  state: InventoryState,
  license: SoftwareLicense,
): SaveResult<InventoryState> {
  const missing = required(license.name, "Software name")
  if (missing) {
    return { ok: false, error: missing }
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
        ? `Software ${numbered.inventoryNumber} updated`
        : `Software ${numbered.inventoryNumber} added (${numbered.name})`,
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

export function removeSoftware(state: InventoryState, id: string): InventoryState {
  const item = state.software.find((license) => license.id === id)
  const nextState = {
    ...state,
    software: state.software.filter((license) => license.id !== id),
  }
  if (!item) {
    return nextState
  }
  return appendHistory(nextState, {
    action: "removed",
    register: "software",
    recordId: item.id,
    inventoryNumber: item.inventoryNumber,
    assetTag: item.entitlementId || item.name,
    serialNumber: "",
    summary: `Software ${item.inventoryNumber} removed from the register`,
    changes: [],
  })
}

export function recordDestruction(
  state: InventoryState,
  record: DestructionRecord,
): SaveResult<InventoryState> {
  const missing = required(
    record.assetTag.trim() || record.inventoryNumber.trim(),
    "Asset tag or inventory number",
  )
  if (missing) {
    return { ok: false, error: missing }
  }

  const match =
    (record.assetTag.trim() ? findHardware(state, record.assetTag) : null) ??
    (record.inventoryNumber.trim() ? findHardware(state, record.inventoryNumber) : null)
  const nextRecord: DestructionRecord = {
    ...record,
    assetTag: (match?.item.assetTag ?? record.assetTag).trim(),
    assetId: match?.id ?? "",
    assetKind: match?.kind ?? record.assetKind,
    inventoryNumber: match?.item.inventoryNumber ?? record.inventoryNumber.trim(),
    serialNumber: match?.item.serialNumber || record.serialNumber,
  }
  const destructions = replaceById(state.destructions, nextRecord)
  const hardware = syncDestroyedHardware(state, destructions)
  const nextState = {
    ...state,
    ...hardware,
    destructions,
  }

  return {
    ok: true,
    state: appendHistory(nextState, {
      action: "destroyed",
      register: "destruction",
      recordId: nextRecord.id,
      inventoryNumber: nextRecord.inventoryNumber,
      assetTag: nextRecord.assetTag,
      serialNumber: nextRecord.serialNumber,
      summary: `Destruction logged for ${nextRecord.inventoryNumber || nextRecord.assetTag}`,
      changes: [],
    }),
  }
}

export function removeDestruction(
  state: InventoryState,
  id: string,
): InventoryState {
  const item = state.destructions.find((record) => record.id === id)
  const destructions = state.destructions.filter((record) => record.id !== id)
  const hardware = syncDestroyedHardware(state, destructions)
  const nextState = {
    ...state,
    ...hardware,
    destructions,
  }
  if (!item) {
    return nextState
  }
  return appendHistory(nextState, {
    action: "destruction-removed",
    register: "destruction",
    recordId: item.id,
    inventoryNumber: item.inventoryNumber,
    assetTag: item.assetTag,
    serialNumber: item.serialNumber,
    summary: `Destruction log removed for ${item.inventoryNumber || item.assetTag}`,
    changes: [],
  })
}

export function newId(): string {
  return crypto.randomUUID()
}
