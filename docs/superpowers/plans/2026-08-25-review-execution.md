# Review execution plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans in this session. Tasks share `catalog.ts`; do not split across parallel writers.

**Goal:** Close the integrity holes six independent reviews agreed on, plus the shop-blocking UX items that do not need a new product.

**Architecture:** Destruction and inventory numbers become one model. Hardware status `destroyed` is derived from a live log. History is validated like the four registers. Desktop German register stays localStorage-only.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, existing domain/catalog.

## Global Constraints

- Desktop workstation only. No phone layout.
- German shop-facing copy.
- No shared backend.
- Internal Excel sheet names stay English (`Laptops`, `Device history`).
- Do not rewrite four pages into `RegisterPage` this pass.
- Do not build a full device-dossier product this pass.

---

### Task 1: Destruction resolve and uniqueness

**Files:** `src/domain/catalog.ts`, `src/domain/normalize.ts`, `src/domain/catalog.test.ts`

- [x] Fail save when tag and inventory number resolve to different assets.
- [x] Match tags to tags and inventory numbers to inventory numbers.
- [x] Respect `assetKind`: `other` does not attach hardware.
- [x] `inventoryNumberTaken` includes destruction numbers unless the log is the linked copy of `exceptId`.
- [x] Tests first for retarget-by-number-with-stale-tag and destruction-number reuse.

### Task 2: Destroyed status is log-driven

**Files:** `src/domain/catalog.ts`, `src/domain/catalog.test.ts`, laptop/printer forms

- [x] Block hardware delete when any destruction `assetId` points at the row.
- [x] Drop `destroyed` from laptop/printer status pickers.
- [x] Hardware upsert refuses a status that conflicts with a live log.
- [x] `syncDestroyedHardware` only flips ids that entered or left the linked set; restore previous non-destroyed status to `in-service` only when unlinked from a log.

### Task 3: History and storage hardening

**Files:** `src/domain/validate.ts`, `src/store/storage.ts`, `src/store/storage.test.ts`, `src/domain/history.ts`, `src/domain/catalog.ts`

- [x] Validate each history event. Missing `history` becomes `[]`. Present-but-invalid fails parse.
- [x] Retarget writes `destruction-removed` for the old asset and `destroyed` for the new. Same-asset edits use `updated` + diffs.
- [x] Reject non-finite software seats/cost.
- [x] `saveInventory` failure does not persist a half-written payload; surface the error.

### Task 4: Shop UX that the reviews blocked on

**Files:** pages, forms, `data-table.tsx`, `record-sheet.tsx`, `status-badge.tsx`, `index.css`, `export-menu.tsx`, `app-shell.tsx`, `history.ts`

- [x] History search prefers exact inventory # / tag / serial; substring on those fields only (not `recordId`).
- [x] Sync History search box to `q`. Wrap Summary/Changes. Show result count.
- [x] Serial column on laptops and printers.
- [x] Destroy action on laptop/printer rows (prefill destruction form). Demote Delete.
- [x] Identifier hints on forms. Confirm-delete titles use inventory number.
- [x] Darken `--input` / `--border`. Fix dialog footer clip. Distinct status pills.
- [x] Export menu: workbook/CSV/backup only. Reset and demo under Sicherung, labeled as data wipe.
- [x] Header lookup field that opens `/history?q=`.
- [x] Inventory # on Übersicht findings. Hide destroyed printers by default.

### Task 5: Verify

- [ ] `npm test`, `npm run typecheck`
- [ ] Browser: destroy from laptop row, conflicting tag/number rejected, History exact search, German chrome
- [ ] Commit, push, update PR
