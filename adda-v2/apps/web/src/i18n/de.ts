export const de = {
  product: "ADDA light",
  instrument: "Kaliber",
  line: "HLL-2",
  stations: {
    anode: "Anode",
    cathode: "Kathode",
    oqc: "OQC",
  },
  lenses: {
    maschine: "Maschine",
    tablett: "Tablett",
    fenster: "Fenster",
    klasse: "Klasse",
    see: "See",
  },
  lensesTitle: "Linsen",
  takt: "Takt",
  taktHint: "Europe/Zurich 00–23",
  kpis: {
    cells: "Teile",
    nio: "NIO",
    yield: "Ausbeute",
    takt: "Takt/h",
    snap: "Snap",
  },
  span: {
    title: "Span",
    min: "min",
    p50: "p50",
    p95: "p95",
    max: "max",
    limit: "Grenze 0,12 mm",
  },
  klasse: {
    title: "Klassen × Stunde",
    cls: "Klasse",
  },
  see: {
    title: "See",
    needCell: "Zelle wählen, dann einen Snapshot antippen.",
    travel: "Zeitreise",
  },
  coupon: "Kupon",
  band: "Band",
  schicht: "Schicht",
  zelle: "Zelle",
  lakeDown: "Lakehouse nicht erreichbar.",
  empty: "Keine Zellen auf der Linie.",
  openCase: "Akte öffnen",
  zeitreise: "Zeitreise",
  pick: "Eine Zelle wählen.",
  io: {
    io: "IO",
    nio: "NIO",
  },
} as const;

export type Lens = keyof typeof de.lenses;
