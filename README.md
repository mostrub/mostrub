## Industrial Systems Engineer
**20+ Years in OT/IT Integration • Edge Computing • Industrial Data Analytics**

![GitHub Stats](./profile/stats.svg)
![Top Langs](./profile/top-langs.svg)

---

# Plant IT inventory

Internal register for the plant IT shop. Laptops by department, type, and OS, plus printers, software seats, and hardware destruction.

This app is **not published**. There is no website, no Netlify site, and no hosted install. You run it on your own computer. The register stays in that browser (`localStorage`). First open loads a plant-floor sample set.

## Install and run

You need **Node.js 22**. Vite 8 will not start on Node 18. Ubuntu `apt nodejs` is Node 18. Do not use it.

| OS | Install Node 22 |
| --- | --- |
| Ubuntu / Debian | [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), or NodeSource |
| Arch Linux | `pacman -S nodejs npm` (npm is a separate package). Check `node -v` is 22 or 20.19+ |
| macOS | `brew install node`, or nvm/fnm |
| Windows 11 | Installer from [nodejs.org](https://nodejs.org), or nvm-windows |

Confirm:

```bash
node -v
```

You should see `v22…` (or `v20.19…` and up). Then get the code and start it **on the same machine**. Do not copy `node_modules` from another OS.

```bash
git clone https://github.com/mostrub/mostrub.git
cd mostrub
npm install
npm run dev
```

Vite prints a Local URL. Open that in the browser. It is usually `http://localhost:5173/`.

That is the whole install. There is no extra verify step, no deploy, and no account.

Stop the app with Ctrl+C in the terminal.

## Registers

- **Laptops.** Unique inventory number, asset tag, serial, hostname, make/model, type (standard, engineering, rugged, loaner, kiosk), operating system, department, assignee, location, warranty.
- **Printers.** Unique inventory number plus MFPs, lasers, labelers, plotters with IP and location.
- **Software.** Unique inventory number, entitlements, seat counts, renewals, annual cost. Over-assigned seats are saved and listed as audit findings.
- **Destruction (Vernichtung).** The device leaves the plant: wipe/recycle, shred, degauss, or vendor return with witness and certificate. This is not the same as **Löschen** (remove a row from the register). Matching laptop or printer tags or inventory numbers are marked destroyed.
- **History.** Search by inventory number, asset tag, or serial to see create, assignment, status, and destruction events for a device.

Every laptop, printer, and software row gets a plant-wide unique inventory number (`INV-0001`, `INV-0002`, … if you leave the field blank). Older browser data and backups without that field are numbered on load.

## Consulting export

**Export → Prüfexport**

- **Excel-Mappe.** 10-tab workbook (cover, summary, registers, findings, history).
- **HTML-Bericht mit Diagrammen.** One file. Open it and use Print → Save as PDF on Linux, macOS, or Windows 11.
- **Einfaches CSV (ein Blatt).** Every row in one table. Semicolon-separated so German Excel opens it in columns.
- CSV zip and per-register CSVs are still there.

JSON backup import asks before replacing the current register. Invalid backups are rejected.
