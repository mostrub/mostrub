import duckdb from "duckdb";

export type DuckDatabase = duckdb.Database;

export function openMemoryDb(): DuckDatabase {
  return new duckdb.Database(":memory:");
}

export function run(db: DuckDatabase, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function all<T>(
  db: DuckDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err: Error | null, rows: T[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

export function closeDb(db: DuckDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function asSafeInt(value: unknown): number {
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Stand-Nummer ${value} überschreitet die sichere Ganzzahl`);
    }
    return Number(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`ganze Zahl erwartet, erhalten ${typeof value}`);
}

export function sqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}
