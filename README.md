## Industrial Systems Engineer
**20+ Years in OT/IT Integration • Edge Computing • Industrial Data Analytics**

![GitHub Stats](./profile/stats.svg)
![Top Langs](./profile/top-langs.svg)

---

# Plant IT inventory

Internal register for the plant IT shop: laptops by department, type, and OS, plus printers, software seats, and hardware destruction.

Data lives in the browser (`localStorage`) and ships with a plant-floor sample set on first load. Export a consulting audit workbook from the header.

## Registers

- **Laptops.** Asset tag, serial, hostname, make/model, type (standard, engineering, rugged, loaner, kiosk), operating system, department, assignee, location, warranty.
- **Printers.** MFPs, lasers, labelers, plotters with IP and location.
- **Software.** Entitlements, seat counts, renewals, annual cost. Assigned seats cannot exceed purchased.
- **Destruction.** Wipe/recycle, shred, degauss, or vendor return with witness and certificate ID. Matching laptop or printer tags are marked destroyed.

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

CSV is available per tab or as a full pack. JSON backup import/export is in the same menu.

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
