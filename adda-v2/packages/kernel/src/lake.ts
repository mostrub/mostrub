import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { asSnapshotId, ledgerError, type SnapshotId } from "@ledger/types";
import pg from "pg";
import { assertTestDatabase } from "./postgres.ts";
import type { LedgerConfig } from "./config.ts";
import {
  all,
  asSafeInt,
  closeDb,
  openMemoryDb,
  run,
  sqlLiteral,
  type DuckDatabase,
} from "./duck.ts";

export type LakeSnapshot = {
  snapshotId: SnapshotId;
  snapshotTime: Date;
  author: string | null;
  commitMessage: string | null;
};

export class Lake {
  private constructor(
    readonly db: DuckDatabase,
    readonly config: LedgerConfig,
  ) {}

  static async open(config: LedgerConfig): Promise<Lake> {
    mkdirSync(resolve(config.lakePath), { recursive: true });
    const db = openMemoryDb();
    try {
      await installExtensions(db);
      await run(db, attachSql(config, { readOnly: false }));
      await run(db, "BEGIN");
      try {
        await bootstrapEvidenceTables(db);
        await run(db, "COMMIT");
      } catch (err) {
        await run(db, "ROLLBACK").catch(() => undefined);
        throw err;
      }
    } catch (err) {
      await closeDb(db).catch(() => undefined);
      throw wrapLakeError(err);
    }
    return new Lake(db, config);
  }

  async close(): Promise<void> {
    await closeDb(this.db);
  }

  async exec(sql: string, params: unknown[] = []): Promise<void> {
    try {
      await run(this.db, sql, params);
    } catch (err) {
      throw wrapLakeError(err);
    }
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      return await all<T>(this.db, sql, params);
    } catch (err) {
      throw wrapLakeError(err);
    }
  }

  async currentSnapshot(): Promise<SnapshotId> {
    const rows = await this.query<{ id: unknown }>("FROM lake.current_snapshot()");
    const first = rows[0];
    if (!first) {
      throw ledgerError("LAKEHOUSE_READ_UNAVAILABLE", "kein aktueller Snapshot", 503);
    }
    return asSnapshotId(asSafeInt(first.id));
  }

  async listSnapshots(): Promise<LakeSnapshot[]> {
    const rows = await this.query<{
      snapshot_id: unknown;
      snapshot_time: Date;
      author: string | null;
      commit_message: string | null;
    }>(
      `SELECT snapshot_id, snapshot_time, author, commit_message
       FROM lake.snapshots()
       ORDER BY snapshot_id`,
    );
    return rows.map((row) => ({
      snapshotId: asSnapshotId(asSafeInt(row.snapshot_id)),
      snapshotTime: row.snapshot_time,
      author: row.author,
      commitMessage: row.commit_message,
    }));
  }

  async withCommit(input: {
    author: string;
    message: string;
    extra?: string;
    work: () => Promise<void>;
  }): Promise<SnapshotId> {
    await this.exec("BEGIN");
    try {
      await input.work();
      const extra = input.extra
        ? `, extra_info => '${sqlLiteral(input.extra)}'`
        : "";
      await this.exec(
        `CALL lake.set_commit_message('${sqlLiteral(input.author)}', '${sqlLiteral(input.message)}'${extra})`,
      );
      await this.exec("COMMIT");
    } catch (err) {
      await this.exec("ROLLBACK").catch(() => undefined);
      throw wrapLakeError(err);
    }
    return this.currentSnapshot();
  }

  static async attachHistorical(
    config: LedgerConfig,
    snapshotId: SnapshotId,
  ): Promise<Lake> {
    const db = openMemoryDb();
    try {
      await installExtensions(db);
      await run(
        db,
        attachSql(config, { readOnly: true, snapshotVersion: snapshotId }),
      );
    } catch (err) {
      await closeDb(db).catch(() => undefined);
      throw wrapLakeError(err);
    }
    return new Lake(db, config);
  }
}

export async function attachAtSnapshot(
  config: LedgerConfig,
  snapshotId: SnapshotId,
): Promise<Lake> {
  return Lake.attachHistorical(config, snapshotId);
}

export async function resetLakeForTests(config: LedgerConfig): Promise<void> {
  assertTestDatabase(config.pgUrl);
  rmSync(resolve(config.lakePath), { recursive: true, force: true });
  const admin = openMemoryDb();
  try {
    await installExtensions(admin);
    const client = new pg.Client({ connectionString: config.pgUrl });
    await client.connect();
    await client.query(
      `DROP SCHEMA IF EXISTS ${quoteIdent(config.metadataSchema)} CASCADE`,
    );
    await client.end();
  } finally {
    await closeDb(admin).catch(() => undefined);
  }
}

async function installExtensions(db: DuckDatabase): Promise<void> {
  await run(db, "INSTALL ducklake");
  await run(db, "INSTALL postgres");
  await run(db, "LOAD ducklake");
  await run(db, "LOAD postgres");
}

function attachSql(
  config: LedgerConfig,
  options: { readOnly: boolean; snapshotVersion?: SnapshotId },
): string {
  // Official ATTACH parameters: DATA_PATH, METADATA_SCHEMA, READ_ONLY, SNAPSHOT_VERSION
  // https://ducklake.select/docs/stable/duckdb/usage/connecting.html
  const catalog = postgresCatalog(config.pgUrl);
  const parts = [
    `DATA_PATH '${sqlLiteral(resolve(config.lakePath))}/'`,
    `METADATA_SCHEMA '${sqlLiteral(config.metadataSchema)}'`,
  ];
  if (options.readOnly) {
    parts.push("READ_ONLY");
  }
  if (options.snapshotVersion !== undefined) {
    parts.push(`SNAPSHOT_VERSION ${options.snapshotVersion}`);
  }
  return `ATTACH 'ducklake:postgres:${catalog}' AS lake (${parts.join(", ")})`;
}

function postgresCatalog(pgUrl: string): string {
  const url = new URL(pgUrl);
  const dbname = url.pathname.replace(/^\//, "");
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  return `dbname=${dbname} host=${url.hostname} port=${url.port || "5432"} user=${user} password=${password}`;
}

async function bootstrapEvidenceTables(db: DuckDatabase): Promise<void> {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lake.inspections (
      inspection_id VARCHAR,
      dmc VARCHAR,
      captured_at TIMESTAMPTZ,
      station VARCHAR,
      tray VARCHAR,
      slot INTEGER,
      part_ok BOOLEAN,
      source VARCHAR
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lake.measurements (
      inspection_id VARCHAR,
      phi_deg DOUBLE,
      width_mm DOUBLE,
      height_mm DOUBLE,
      span_mm DOUBLE
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lake.findings (
      inspection_id VARCHAR,
      defect_class VARCHAR,
      score DOUBLE
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS lake.line_events (
      event_id VARCHAR,
      dmc VARCHAR,
      observed_at TIMESTAMPTZ,
      verdict VARCHAR,
      source VARCHAR
    )`,
  );
}

function wrapLakeError(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err) {
    return err as Error;
  }
  const message = err instanceof Error ? err.message : String(err);
  return ledgerError("LAKEHOUSE_READ_UNAVAILABLE", message, 503);
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw ledgerError("INVALID_DATABASE", `ungültiger Schema-Name ${name}`, 500);
  }
  return `"${name}"`;
}
