import { describe, expect, it } from "vitest";
import { LedgerError } from "../../packages/types/src/index.ts";
import { assertTestDatabase } from "../../packages/kernel/src/postgres.ts";

describe("assertTestDatabase", () => {
  it("refuses a production-looking database name", () => {
    expect(() =>
      assertTestDatabase("postgres://ledger:ledger@127.0.0.1:5432/ledger"),
    ).toThrow(LedgerError);
    try {
      assertTestDatabase("postgres://ledger:ledger@127.0.0.1:5432/ledger");
    } catch (err) {
      expect(err).toBeInstanceOf(LedgerError);
      expect((err as LedgerError).code).toBe("INVALID_DATABASE");
    }
  });

  it("allows ledger_test", () => {
    expect(() =>
      assertTestDatabase("postgres://ledger:ledger@127.0.0.1:5432/ledger_test"),
    ).not.toThrow();
  });
});
