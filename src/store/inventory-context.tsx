/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import {
  emptyInventory,
  recordDestruction,
  removeDestruction,
  removeLaptop,
  removePrinter,
  removeSoftware,
  upsertLaptop,
  upsertPrinter,
  upsertSoftware,
} from "@/domain/catalog"
import type {
  DestructionRecord,
  InventoryState,
  Laptop,
  Printer,
  SaveResult,
  SoftwareLicense,
} from "@/domain/types"
import {
  STORAGE_KEY,
  clearToEmpty,
  loadInventory,
  parseInventoryJson,
  resetInventory,
  saveInventory,
} from "./storage"

type InventoryContextValue = {
  state: InventoryState
  storageError: string | null
  saveLaptop: (laptop: Laptop) => string | null
  savePrinter: (printer: Printer) => string | null
  saveSoftware: (license: SoftwareLicense) => string | null
  saveDestruction: (record: DestructionRecord) => string | null
  deleteLaptop: (id: string) => string | null
  deletePrinter: (id: string) => string | null
  deleteSoftware: (id: string) => string | null
  deleteDestruction: (id: string) => string | null
  replaceState: (next: InventoryState) => string | null
  resetToEmpty: () => string | null
  loadDemo: () => string | null
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined)

function persist(next: InventoryState): InventoryState {
  saveInventory(next)
  return next
}

function storageFailure(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Inventar konnte nicht gespeichert werden"
}

function applyResult(
  setState: (updater: (current: InventoryState) => InventoryState) => void,
  mutator: (current: InventoryState) => SaveResult<InventoryState>,
): string | null {
  let error: string | null = null
  setState((current) => {
    const result = mutator(current)
    if (!result.ok) {
      error = result.error
      return current
    }
    try {
      persist(result.state)
      return result.state
    } catch (caught) {
      error = storageFailure(caught)
      return current
    }
  })
  return error
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(loadInventory)
  const [state, setState] = useState<InventoryState>(() =>
    boot.status === "ok" ? boot.state : emptyInventory(),
  )
  const [storageError, setStorageError] = useState<string | null>(
    boot.status === "corrupt" ? boot.reason : null,
  )

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return
      }
      const parsed = parseInventoryJson(event.newValue)
      if (!parsed.ok) {
        return
      }
      setStorageError(null)
      setState(parsed.state)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const value = useMemo<InventoryContextValue>(() => {
    return {
      state,
      storageError,
      saveLaptop: (laptop) => applyResult(setState, (current) => upsertLaptop(current, laptop)),
      savePrinter: (printer) =>
        applyResult(setState, (current) => upsertPrinter(current, printer)),
      saveSoftware: (license) =>
        applyResult(setState, (current) => upsertSoftware(current, license)),
      saveDestruction: (record) =>
        applyResult(setState, (current) => recordDestruction(current, record)),
      deleteLaptop: (id) => applyResult(setState, (current) => removeLaptop(current, id)),
      deletePrinter: (id) => applyResult(setState, (current) => removePrinter(current, id)),
      deleteSoftware: (id) => applyResult(setState, (current) => removeSoftware(current, id)),
      deleteDestruction: (id) =>
        applyResult(setState, (current) => removeDestruction(current, id)),
      replaceState: (next) => {
        const error = applyResult(setState, () => ({ ok: true, state: next }))
        if (!error) {
          setStorageError(null)
        }
        return error
      },
      resetToEmpty: () => {
        try {
          setState(clearToEmpty())
          setStorageError(null)
          return null
        } catch (caught) {
          return storageFailure(caught)
        }
      },
      loadDemo: () => {
        try {
          setState(resetInventory())
          setStorageError(null)
          return null
        } catch (caught) {
          return storageFailure(caught)
        }
      },
    }
  }, [state, storageError])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within InventoryProvider")
  }
  return context
}
