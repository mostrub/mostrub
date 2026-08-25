import { configFromEnv, Ledger } from "@ledger/kernel";

const day = process.argv[2] ?? "2026-08-24";
const ledger = await Ledger.open(configFromEnv());
const result = await ledger.seed(day);
process.stdout.write(
  `seed ${day}: ${result.inspections} inspections, ${result.lineEvents} line events, ${result.dmcs.length} DMCs\n`,
);
await ledger.close();
