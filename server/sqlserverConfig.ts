import sql from "mssql";

export function getSqlServerConnectionConfig(): string | sql.config | undefined {
  const raw = process.env.SQLSERVER_URL ?? process.env.DATABASE_URL;
  if (!raw) return undefined;

  if (!raw.startsWith("mssql://")) return raw;

  const url = new URL(raw);
  return {
    server: url.hostname,
    port: url.port ? Number(url.port) : 1433,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    options: {
      encrypt: url.searchParams.get("encrypt") === "true",
      trustServerCertificate: url.searchParams.get("trustServerCertificate") !== "false",
    },
  };
}

