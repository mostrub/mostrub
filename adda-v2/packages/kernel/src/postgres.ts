import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ledgerError } from "@ledger/types";
import pg from "pg";
import { databaseNameFromUrl } from "./config.ts";

const { Pool } = pg;

export function assertTestDatabase(url: string): void {
  const name = databaseNameFromUrl(url);
  if (!name.toLowerCase().includes("test")) {
    throw ledgerError(
      "INVALID_DATABASE",
      `Migration oder Leeren von '${name}' verweigert, der Name enthält kein «test»`,
      500,
    );
  }
}

export function createPool(url: string): pg.Pool {
  return new Pool({
    connectionString: url,
    max: 8,
    idleTimeoutMillis: 10_000,
  });
}

export async function migrateControl(pool: pg.Pool): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(here, "control-schema.sql"), "utf8");
  await pool.query(sql);
}

export async function resetControlForTests(pool: pg.Pool, url: string): Promise<void> {
  assertTestDatabase(url);
  await pool.query("DROP SCHEMA IF EXISTS control CASCADE");
  await migrateControl(pool);
}

export type AuditAction =
  | "ingest.inspections"
  | "ingest.line_events"
  | "case.open"
  | "case.pin"
  | "case.disposition"
  | "seed";

export class ControlStore {
  constructor(private readonly pool: pg.Pool) {}

  async query<T extends pg.QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, values);
    return result.rows;
  }

  async writeAudit(input: {
    id: string;
    at: Date;
    actor: string;
    action: AuditAction;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO control.audit_events (id, at, actor, action, payload_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.id, input.at, input.actor, input.action, JSON.stringify(input.payload)],
    );
  }
}
