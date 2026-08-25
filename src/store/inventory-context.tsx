/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

import {
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
  SoftwareLicense,
} from "@/domain/types"
import { loadInventory, saveInventory } from "./storage"

type InventoryContextValue = {
  state: InventoryState
  saveLaptop: (laptop: Laptop) => string | null
  savePrinter: (printer: Printer) => string | null
  saveSoftware: (license: SoftwareLicense) => string | null
  saveDestruction: (record: DestructionRecord) => string | null
  deleteLaptop: (id: string) => void
  deletePrinter: (id: string) => void
  deleteSoftware: (id: string) => void
  deleteDestruction: (id: string) => void
  replaceState: (next: InventoryState) => void
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined)

function persist(next: InventoryState): InventoryState {
  saveInventory(next)
  return next
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InventoryState>(() => loadInventory())

  const value = useMemo<InventoryContextValue>(() => {
    return {
      state,
      saveLaptop: (laptop) => {
        const result = upsertLaptop(state, laptop)
        if (!result.ok) {
          return result.error
        }
        setState(persist(result.state))
        return null
      },
      savePrinter: (printer) => {
        const result = upsertPrinter(state, printer)
        if (!result.ok) {
          return result.error
        }
        setState(persist(result.state))
        return null
      },
      saveSoftware: (license) => {
        const result = upsertSoftware(state, license)
        if (!result.ok) {
          return result.error
        }
        setState(persist(result.state))
        return null
      },
      saveDestruction: (record) => {
        const result = recordDestruction(state, record)
        if (!result.ok) {
          return result.error
        }
        setState(persist(result.state))
        return null
      },
      deleteLaptop: (id) => {
        setState((current) => persist(removeLaptop(current, id)))
      },
      deletePrinter: (id) => {
        setState((current) => persist(removePrinter(current, id)))
      },
      deleteSoftware: (id) => {
        setState((current) => persist(removeSoftware(current, id)))
      },
      deleteDestruction: (id) => {
        setState((current) => persist(removeDestruction(current, id)))
      },
      replaceState: (next) => {
        setState(persist(next))
      },
    }
  }, [state])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within InventoryProvider")
  }
  return context
}
