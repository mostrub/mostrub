import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import {
  asCaseId,
  asSnapshotId,
  dispositionSchema,
  inspectionIngestSchema,
  LedgerError,
  lineEventIngestSchema,
  openCaseSchema,
  parseDmc,
  pinCaseSchema,
} from "@ledger/types";
import type { Ledger } from "@ledger/kernel";
import { apiConfigFromEnv, bearerToken, isLoopback, type ApiConfig } from "./config.ts";

export type AppEnv = {
  Variables: {
    ledger: Ledger;
    api: ApiConfig;
  };
};

const BODY_LIMIT = 512 * 1024;

export function createApp(ledger: Ledger, api: ApiConfig = apiConfigFromEnv()): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("ledger", ledger);
    c.set("api", api);
    await next();
  });
  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.onError((err, c) => {
    if (err instanceof LedgerError) {
      return c.json(
        { error: err.code, message: err.message },
        err.status as 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
      );
    }
    if (err instanceof ZodError) {
      return c.json(
        { error: "VALIDATION_FAILED", message: err.issues[0]?.message ?? "ungültige Eingabe" },
        422,
      );
    }
    const message = err instanceof Error ? err.message : "unbekannter Fehler";
    return c.json({ error: "LAKEHOUSE_READ_UNAVAILABLE", message }, 503);
  });

  app.get("/health", async (c) => {
    const status = await c.get("ledger").lakeStatus();
    return c.json({
      ok: true,
      service: "adda-light",
      snapshotId: status.currentSnapshotId,
    });
  });

  app.get("/api/lake/status", async (c) => {
    return c.json(await c.get("ledger").lakeStatus());
  });

  app.get("/api/see/snapshots", async (c) => {
    const status = await c.get("ledger").lakeStatus();
    return c.json(status);
  });

  app.get("/api/cells/:dmc", async (c) => {
    const dmc = parseDmc(c.req.param("dmc"));
    const dossier = await c.get("ledger").loadDossier(dmc);
    const openCases = await c.get("ledger").listOpenCasesForDmc(dmc);
    return c.json({ ...dossier, openCases });
  });

  app.get("/api/see/at/:snapshotId/cells/:dmc", async (c) => {
    const snapshotId = asSnapshotId(Number(c.req.param("snapshotId")));
    if (!Number.isFinite(snapshotId)) {
      return c.json({ error: "VALIDATION_FAILED", message: "ungültige Snapshot-Id" }, 422);
    }
    const dossier = await c.get("ledger").loadDossierAt(
      parseDmc(c.req.param("dmc")),
      snapshotId,
    );
    return c.json(dossier);
  });

  app.get("/api/chronik", async (c) => {
    const dmc = c.req.query("dmc");
    const from = c.req.query("from");
    const to = c.req.query("to");
    const limit = c.req.query("limit");
    return c.json(
      await c.get("ledger").chronik({
        ...(dmc ? { dmc } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(limit ? { limit: Number(limit) } : {}),
      }),
    );
  });

  app.get("/api/linie", async (c) => {
    return c.json(await c.get("ledger").lineBoard());
  });

  app.get("/api/schicht", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    const window =
      from && to ? { from, to } : await c.get("ledger").latestShiftWindow();
    return c.json(await c.get("ledger").shiftReport(window));
  });

  app.get("/api/cases", async (c) => {
    const status = c.req.query("status");
    if (status === "open" || status === "pinned" || status === "closed") {
      return c.json({ cases: await c.get("ledger").listCases(status) });
    }
    return c.json({ cases: await c.get("ledger").listCases() });
  });

  app.get("/api/cases/:id", async (c) => {
    return c.json(await c.get("ledger").loadCase(asCaseId(c.req.param("id"))));
  });

  app.post("/api/cases", async (c) => {
    denyIfMutationBlocked(c);
    const input = openCaseSchema.parse(await readJson(c));
    return c.json(await c.get("ledger").openCase(input), 201);
  });

  app.post("/api/cases/:id/pin", async (c) => {
    denyIfMutationBlocked(c);
    const input = pinCaseSchema.parse(await readJson(c));
    const snapshot = await c.get("ledger").lake.currentSnapshot();
    return c.json(
      await c.get("ledger").pinCase(asCaseId(c.req.param("id")), snapshot, input),
    );
  });

  app.post("/api/cases/:id/dispositions", async (c) => {
    denyIfMutationBlocked(c);
    const input = dispositionSchema.parse(await readJson(c));
    return c.json(
      await c.get("ledger").addDisposition(asCaseId(c.req.param("id")), input),
    );
  });

  app.post("/_internal/ingest/inspections", async (c) => {
    denyIfIngestBlocked(c);
    const body = await readJson(c);
    const rows = Array.isArray(body) ? body : [body];
    const parsed = rows.map((row) => inspectionIngestSchema.parse(row));
    return c.json(await c.get("ledger").ingestInspections(parsed, "ingest"), 201);
  });

  app.post("/_internal/ingest/line-events", async (c) => {
    denyIfIngestBlocked(c);
    const body = await readJson(c);
    const rows = Array.isArray(body) ? body : [body];
    const parsed = rows.map((row) => lineEventIngestSchema.parse(row));
    return c.json(await c.get("ledger").ingestLineEvents(parsed, "ingest"), 201);
  });

  return app;
}

function denyIfIngestBlocked(c: { req: { header: (n: string) => string | undefined }; get: (k: "api") => ApiConfig }): void {
  const api = c.get("api");
  if (!api.ingestToken) {
    throw new LedgerError("INGEST_FORBIDDEN", "Ingest-Token fehlt, Schreibzugriff gesperrt", 401);
  }
  const token = bearerToken(c.req.header("authorization"));
  if (token !== api.ingestToken) {
    throw new LedgerError("INGEST_FORBIDDEN", "Ingest nicht autorisiert", 401);
  }
  const forwarded = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");
  if (forwarded) {
    throw new LedgerError("INGEST_FORBIDDEN", "Forwarding-Header abgelehnt", 403);
  }
}

function denyIfMutationBlocked(c: {
  req: { header: (n: string) => string | undefined };
  get: (k: "api") => ApiConfig;
}): void {
  const api = c.get("api");
  const token = bearerToken(c.req.header("authorization"));
  const loopback = isLoopback(c.req.header("x-forwarded-for") ? undefined : "127.0.0.1");
  if (token && api.operatorToken && token === api.operatorToken) {
    return;
  }
  if (loopback && !c.req.header("x-forwarded-for")) {
    return;
  }
  throw new LedgerError("INGEST_FORBIDDEN", "Mutation nicht autorisiert", 401);
}

async function readJson(c: { req: { raw: Request } }): Promise<unknown> {
  const text = await c.req.raw.text();
  if (text.length > BODY_LIMIT) {
    throw new LedgerError("VALIDATION_FAILED", "JSON zu gross", 422);
  }
  if (text.length === 0) {
    throw new LedgerError("VALIDATION_FAILED", "leerer Body", 422);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LedgerError("VALIDATION_FAILED", "JSON ungültig", 422);
  }
}

