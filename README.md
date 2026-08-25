## Industrial Systems Engineer
**20+ Years in OT/IT Integration • Edge Computing • Industrial Data Analytics**

![GitHub Stats](./profile/stats.svg)
![Top Langs](./profile/top-langs.svg)

### Tailboard

4K Tailscale operations board for a TV or desk monitor. One binary, SQLite history, always-on alerts, jail-level traces. See [`tailboard/README.md`](./tailboard/README.md).

---

# Plant IT inventory

Internal register for the plant IT shop: laptops by department, type, and OS, plus printers, software seats, and hardware destruction.

Data lives in the browser (`localStorage`) and ships with a plant-floor sample set on first load. No Netlify login is required to run it locally.

## Registers

- **Laptops.** Unique inventory number, asset tag, serial, hostname, make/model, type (standard, engineering, rugged, loaner, kiosk), operating system, department, assignee, location, warranty.
- **Printers.** Unique inventory number plus MFPs, lasers, labelers, plotters with IP and location.
- **Software.** Unique inventory number, entitlements, seat counts, renewals, annual cost. Over-assigned seats are saved and listed as audit findings.
- **Destruction (Vernichtung).** The device leaves the plant: wipe/recycle, shred, degauss, or vendor return with witness and certificate. This is not the same as **Löschen** (remove a row from the register). Matching laptop or printer tags or inventory numbers are marked destroyed.
- **History.** Search by inventory number, asset tag, or serial to see create, assignment, status, and destruction events for a device.

Every laptop, printer, and software row gets a plant-wide unique inventory number (`INV-0001`, `INV-0002`, … if you leave the field blank). Older browser data and backups without that field are numbered on load.

## Consulting export

**Export → Prüfexport**

- **Excel-Mappe** — 10-tab workbook (cover, summary, registers, findings, history).
- **HTML-Bericht mit Diagrammen** — one file. Open it and use Print → Save as PDF on Linux, macOS, or Windows 11.
- **Einfaches CSV (ein Blatt)** — every row in one table. Semicolon-separated so German Excel opens it in columns.
- CSV zip and per-register CSVs are still there.

JSON backup import asks before replacing the current register. Invalid backups are rejected.

## Run

Needs **Node.js 22** (or 20.19+). Vite 8 will not start on Node 18.

| OS | How to get Node 22 |
| --- | --- |
| Ubuntu / Debian | Do not use `apt nodejs` (that is 18). Use [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), or NodeSource. |
| Arch Linux | `pacman -S nodejs npm` (npm is a separate package). Confirm `node -v` is 20.19+ or 22. |
| macOS | `brew install node` or nvm/fnm. |
| Windows 11 | Installer from [nodejs.org](https://nodejs.org) or nvm-windows. |

Always run `npm install` **on the machine you will use**. Do not copy `node_modules` between Linux, macOS, and Windows.

```bash
npm install
npm test
npm run dev
```

Open the Local URL Vite prints (usually `http://localhost:5173/`).

```bash
npm run typecheck
npm run build
npm run preview
```

Build for Netlify (`NODE_VERSION=22` in `netlify.toml`):

```bash
npm run build
```

Publish directory is `dist`. SPA routes rewrite to `index.html` via `netlify.toml`.
