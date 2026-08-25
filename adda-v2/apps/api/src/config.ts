export type ApiConfig = {
  host: string;
  port: number;
  ingestToken: string;
  operatorToken: string;
};

export function apiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: env.LEDGER_API_HOST ?? "127.0.0.1",
    port: Number(env.LEDGER_API_PORT ?? "5757"),
    ingestToken: env.LEDGER_INGEST_TOKEN ?? "",
    operatorToken: env.LEDGER_OPERATOR_TOKEN ?? "",
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export function isLoopback(ip: string | undefined): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === ":ffff:127.0.0.1";
}
