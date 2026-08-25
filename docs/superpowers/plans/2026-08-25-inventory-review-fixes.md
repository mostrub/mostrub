# Inventory review fixes — 2026-08-25

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use TDD.

**Goal:** Close Critical/High findings from the independent review of PR #7 without adding a shared backend. After this plan, a plant IT lead can restore a backup without wiping live data, destruction logs stay linked to the right asset, and consulting exports match the on-screen counts.

**Architecture:** Keep the Vite + localStorage SPA. Move inventory integrity into the domain and storage layers so pages cannot silently persist invalid JSON or leave assets in the wrong status. Export stays client-side; CSV pack becomes a zip so browsers do not drop eight of nine files.

**Tech stack:** Vite, React 19, TypeScript, Vitest, ExcelJS, JSZip, Tailwind, shadcn.

**Base:** `cursor/it-inventory-system-58eb` (PR https://github.com/mostrub/mostrub/pull/7)

---

## Review verdict

Four independent reviews (architecture, thermo-nuclear, code quality, product) agreed: **do not merge as-is.**

| Severity | Finding | Disposition |
|---|---|---|
| Critical | JSON import + load accept any four arrays; failed parse silently reseeds and next save overwrites real data | **This plan** |
| Critical | Destruction match is exact-string; `recordDestruction` does not resolve `assetId`; edit/delete does not restore status | **This plan** |
| Critical | Overview / Excel department counts include destroyed while copy says they do not | **This plan** |
| Critical | No shared multi-user store | **Out of scope** (local tool this pass) |
| High | Export errors swallowed; UTC dates; expired licenses drop off findings; over-assign blocked so exceptions tab is empty; CSV formula injection; CSV pack fires 9 downloads | **This plan** |
| Important | Context save closures stale; ConfirmDelete copy lies for destruction; annual cost is a rounded string | **This plan** |
| Later | Unique serials, laptop filters, attachments, two-person CoC, person records, RegisterPage DRY | **Follow-up** |

---

### Task 1: Safe storage load and import

**Files:**
- Create: `src/store/storage.test.ts`
- Modify: `src/store/storage.ts`
- Modify: `src/store/inventory-context.tsx`
- Modify: `src/components/export-menu.tsx`
- Modify: `src/App.tsx` (reset + load-error UI)

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { parseInventoryJson, isInventoryState } from "./storage";

describe("parseInventoryJson", () => {
  it("rejects a backup whose laptop rows are empty objects", () => {
    const raw = JSON.stringify({
      generatedAt: "x",
      laptops: [{}],
      printers: [],
      software: [],
      destructions: [],
    });
    expect(parseInventoryJson(raw).ok).toBe(false);
  });

  it("accepts a valid empty inventory", () => {
    const raw = JSON.stringify({
      generatedAt: new Date().toISOString(),
      laptops: [],
      printers: [],
      software: [],
      destructions: [],
    });
    expect(parseInventoryJson(raw).ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/storage.test.ts`
Expected: FAIL — `parseInventoryJson` does not exist / `isInventoryState` still accepts `[{}]`.

**Step 3: Implement**

- Add `src/domain/validate.ts` with field-level checks for laptop / printer / software / destruction records (required strings, known enums, finite numbers).
- `isInventoryState` must use those checks.
- `parseInventoryJson(raw)` returns `{ ok: true, state } | { ok: false, reason }`.
- `loadState()`:
  - missing key → persist and return seed (first visit).
  - present but invalid → return `{ kind: "corrupt", reason }` **without writing seed**.
- Context: if load is corrupt, show a blocking panel: keep working from empty, or pick a backup. Do not silently become Plant IT demo.
- Import: confirm (“Replace the current inventory with this backup?”). On invalid JSON, toast and keep current state.
- Header: Reset to empty and Reload demo, both behind confirm.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/storage.ts src/store/storage.test.ts src/store/inventory-context.tsx src/domain/validate.ts src/components/export-menu.tsx src/App.tsx
git commit -m "Reject invalid inventory backups instead of reseeding"
```

---

### Task 2: Destruction linking in the domain

**Files:**
- Modify: `src/domain/catalog.ts`
- Modify: `src/domain/catalog.test.ts`
- Modify: `src/pages/destruction-page.tsx`
- Modify: `src/components/confirm-delete.tsx`

**Step 1: Write the failing tests**

Add to `catalog.test.ts`:

```ts
it("links a destruction to a laptop when the tag has spaces or different case", () => {
  const after = recordDestruction(state, {
    ...blankDestruction(),
    assetTag: "lt-1001 ",
    method: "Shred",
    performedOn: "2026-08-01",
    performedBy: "IT",
    witness: "Security",
    certificateId: "COC-1",
  });
  const row = after.destructions[0];
  expect(row.assetId).toBe("lap-1");
  expect(after.laptops.find((l) => l.id === "lap-1")?.status).toBe("Destroyed");
});

it("restores the previous status when the last destruction for an asset is removed", () => {
  const withLog = recordDestruction(state, { ... });
  const after = removeDestruction(withLog, withLog.destructions[0].id);
  expect(after.laptops.find((l) => l.id === "lap-1")?.status).toBe("In service");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/catalog.test.ts`
Expected: FAIL — `assetId` stays `""`, remove does not restore status.

**Step 3: Implement**

- `normalizeAssetTag(tag)` = trim + lowercase (already used for uniqueness).
- `findAssetByTag(state, tag)` searches laptops then printers.
- `recordDestruction` always resolves `assetId` from tag; if found, set that asset to Destroyed (remember `previousStatus` on the log if we add the field — optional; otherwise restore to `In service` when no other open log points at the asset).
- `removeDestruction` / retarget: if no remaining destruction references `assetId`, restore status to `In service` unless the user had set Spare/Repair — **simpler rule:** restore to `In service` if the asset is currently `Destroyed` and no other log references it.
- Destruction page: submit the draft as-is; do not pre-resolve in the page.
- `ConfirmDelete`: accept optional `description` so destruction delete does not claim history is kept.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/catalog.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain/catalog.ts src/domain/catalog.test.ts src/pages/destruction-page.tsx src/components/confirm-delete.tsx
git commit -m "Resolve destruction asset links in the catalog"
```

---

### Task 3: Honest summaries and license findings

**Files:**
- Create: `src/domain/summary.ts`, `src/domain/summary.test.ts`
- Modify: `src/domain/findings.ts`, `src/domain/findings.test.ts`, `src/domain/types.ts`, `src/domain/labels.ts`
- Modify: `src/domain/catalog.ts` (`upsertSoftware` allow over-assign)
- Modify: `src/export/workbook.ts`, `src/pages/dashboard-page.tsx`, `src/pages/software-page.tsx`

**Step 1: Write the failing tests**

```ts
it("excludes destroyed laptops from department counts", () => {
  const counts = countLaptopsByDepartment(state);
  expect(counts.find((c) => c.department === "Production")?.count).toBe(1); // not 2
});

it("flags an expired license as license-expired", () => {
  const findings = collectFindings({
    ...empty,
    software: [{ ...blankSoftware(), assignedSeats: 1, expiresOn: "2020-01-01" }],
  });
  expect(findings.some((f) => f.code === "license-expired")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/summary.test.ts src/domain/findings.test.ts`
Expected: FAIL

**Step 3: Implement**

- `countLaptopsByDepartment` / `summarizeInventory` exclude `Destroyed`.
- Dashboard and workbook Laptops-by-department use that helper.
- Findings: `remaining < 0` → `license-expired` (High); `0–30` stays `license-expiring`.
- `upsertSoftware`: allow `assignedSeats > purchasedSeats` (warning in the form, not a hard block).
- Workbook `annualCost`: number (purchased × unit), not a currency string. Cover sheet can still format currency.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/summary.test.ts src/domain/findings.test.ts src/export/workbook.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/domain src/export/workbook.ts src/pages/dashboard-page.tsx src/pages/software-page.tsx
git commit -m "Align department counts and license findings with audit copy"
```

---

### Task 4: Export robustness

**Files:**
- Modify: `src/export/csv.ts`, `src/export/csv.test.ts`, `src/export/download.ts`, `src/export/workbook.ts`
- Modify: `src/components/export-menu.tsx`
- Modify: `src/lib/dates.ts` (create)
- Add dependency: `jszip`

**Step 1: Write the failing tests**

```ts
it("prefixes a leading equals sign so spreadsheets do not execute formulas", () => {
  expect(csvEscape("=1+1")).toBe("'=1+1");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/csv.test.ts`
Expected: FAIL

**Step 3: Implement**

- `csvEscape`: if value starts with `= + - @ \t \r`, prefix `'`.
- UTF-8 BOM on CSV blobs.
- `downloadCsvPack` → single `inventory-csv-pack-YYYY-MM-DD.zip` via JSZip.
- `localDateStamp()` using `getFullYear/getMonth/getDate` (not `toISOString`).
- Export menu: `await` downloads, toast on failure.
- Typed sheet keys instead of matching `tab.title` strings for CSV.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/export`
Expected: PASS

**Step 5: Commit**

```bash
git add src/export src/lib/dates.ts src/components/export-menu.tsx package.json package-lock.json
git commit -m "Harden CSV and Excel exports for consulting handoff"
```

---

### Task 5: Store commits and laptop filters

**Files:**
- Modify: `src/store/inventory-context.tsx`
- Modify: `src/pages/laptops-page.tsx`
- Modify: `src/pages/audit-page.tsx` (local date)

**Step 1: Write the failing tests**

No new domain test required if Task 1–4 cover integrity. Add a small store helper test only if `commit` is extracted.

**Step 2: Implement**

- Every `save*` uses `setState((current) => { const next = upsert(current, record); persist(next); return next; })`.
- Laptop page: filter chips or selects for department, type, OS, status (default hide Destroyed, with a toggle).
- Audit “as of” uses `localDateStamp()`.
- Block deleting a laptop/printer whose status is Destroyed (toast: remove the destruction log first). Optional unique-serial check when serial is non-empty.

**Step 3: Run full suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all green

**Step 4: Commit**

```bash
git add src
git commit -m "Commit inventory updates from latest state and filter laptops"
```

---

### Task 6: Verify in the browser

Manual checks against `http://127.0.0.1:5173`:

1. Import a file `{ laptops: [{}], printers: [], software: [], destructions: [] }` — toast, data unchanged.
2. Destruction `lt-1001 ` + witness — Production-01 becomes Destroyed; Excel department Production count drops.
3. Software assigned > purchased — saves; Audit + License exceptions show the row; expired license shows `license-expired`.
4. CSV pack is one zip.
5. Reset to empty after confirm leaves zero laptops.

---

## Self-review

**1. Spec coverage**
- [x] Invalid backup rejected
- [x] Destruction tag normalize + restore
- [x] Department counts exclude destroyed
- [x] Expired + over-assigned licenses visible
- [x] CSV injection + single zip
- [ ] Shared backend — explicitly deferred

**2. Placeholder scan**
No TBD steps. Out-of-scope items are labeled Follow-up.

**3. Type consistency**
`FindingCode` gains `license-expired`. Workbook annual cost becomes `number`.

---
