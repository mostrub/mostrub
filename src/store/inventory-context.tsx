/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

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
import { clearToEmpty, loadInventory, resetInventory, saveInventory } from "./storage"

type InventoryContextValue = {
  state: InventoryState
  storageError: string | null
  saveLaptop: (laptop: Laptop) => string | null
  savePrinter: (printer: Printer) => string | null
  saveSoftware: (license: SoftwareLicense) => string | null
  saveDestruction: (record: DestructionRecord) => string | null
  deleteLaptop: (id: string) => string | null
  deletePrinter: (id: string) => string | null
  deleteSoftware: (id: string) => void
  deleteDestruction: (id: string) => void
  replaceState: (next: InventoryState) => void
  resetToEmpty: () => void
  loadDemo: () => void
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined)

function persist(next: InventoryState): InventoryState {
  saveInventory(next)
  return next
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
    return persist(result.state)
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
      deleteSoftware: (id) => {
        setState((current) => persist(removeSoftware(current, id)))
      },
      deleteDestruction: (id) => {
        setState((current) => persist(removeDestruction(current, id)))
      },
      replaceState: (next) => {
        setStorageError(null)
        setState(persist(next))
      },
      resetToEmpty: () => {
        setStorageError(null)
        setState(clearToEmpty())
      },
      loadDemo: () => {
        setStorageError(null)
        setState(resetInventory())
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
