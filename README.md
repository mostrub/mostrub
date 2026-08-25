## Industrial Systems Engineer
**20+ Years in OT/IT Integration • Edge Computing • Industrial Data Analytics**

![GitHub Stats](./profile/stats.svg)
![Top Langs](./profile/top-langs.svg)

---

# Plant IT inventory

Internal register for the plant IT shop: laptops by department, type, and OS, plus printers, software seats, and hardware destruction.

Data lives in the browser (`localStorage`) and ships with a plant-floor sample set on first load. Export a consulting audit workbook from the header.

## Registers

- **Laptops.** Unique inventory number, asset tag, serial, hostname, make/model, type (standard, engineering, rugged, loaner, kiosk), operating system, department, assignee, location, warranty.
- **Printers.** Unique inventory number plus MFPs, lasers, labelers, plotters with IP and location.
- **Software.** Unique inventory number, entitlements, seat counts, renewals, annual cost. Over-assigned seats are saved and listed as audit findings.
- **Destruction.** Wipe/recycle, shred, degauss, or vendor return with witness and certificate ID. Matching laptop or printer tags or inventory numbers (trim and case ignored) are marked destroyed.
- **History.** Search by inventory number, asset tag, or serial to see create, assignment, status, and destruction events for a device.

Every laptop, printer, and software row gets a plant-wide unique inventory number (`INV-0001`, `INV-0002`, … if you leave the field blank). Older browser data and backups without that field are numbered on load. Destruction rows copy the linked device's number.

## Consulting export

**Export → Excel workbook (all tabs)** writes:

1. Cover
2. Summary
3. Laptops
4. Laptops by department
5. Printers
6. Software licenses
7. License exceptions
8. Destruction log
9. Audit findings
10. Device history

CSV is available per tab or as one zip. JSON backup import asks before replacing the current register. Invalid backups are rejected and a failed browser load is not overwritten with the demo plant.

## Run

```bash
npm install
npm test
npm run dev
```

Build for Netlify:

```bash
npm run build
```

Publish directory is `dist`. SPA routes rewrite to `index.html` via `netlify.toml`.
