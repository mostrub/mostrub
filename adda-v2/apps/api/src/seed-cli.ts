import { configFromEnv, Ledger } from "@ledger/kernel";

const day = process.argv[2] ?? "2026-08-24";
const ledger = await Ledger.open(configFromEnv());
const result = await ledger.seed(day);
process.stdout.write(
  `Seed ${day}: ${result.inspections} Inspektionen, ${result.lineEvents} Linienereignisse, ${result.dmcs.length} DMCs\n`,
);
await ledger.close();
