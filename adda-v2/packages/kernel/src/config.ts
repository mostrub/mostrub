export type LedgerConfig = {
  pgUrl: string;
  lakePath: string;
  metadataSchema: string;
};

export function configFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LedgerConfig {
  return {
    pgUrl: env.LEDGER_PG_URL ?? "postgres://ledger:ledger@127.0.0.1:5432/ledger",
    lakePath: env.LEDGER_LAKE_PATH ?? "data/lake",
    metadataSchema: env.LEDGER_METADATA_SCHEMA ?? "ducklake",
  };
}

export function databaseNameFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}
