import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sql from "mssql";

function getSqlServerConnectionConfig() {
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

const connectionConfig = getSqlServerConnectionConfig();

if (!connectionConfig) {
  console.error("SQLSERVER_URL ou DATABASE_URL nao configurada.");
  process.exit(1);
}

const sqlPath = path.resolve("database/sqlserver/001_create_delivery_schema.sql");
const script = await fs.readFile(sqlPath, "utf8");
const batches = script
  .split(/^\s*GO\s*;?\s*$/gim)
  .map((batch) => batch.trim())
  .filter(Boolean);

const pool = await sql.connect(connectionConfig);

try {
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  console.log("Schema delivery criado/atualizado com sucesso.");
} finally {
  await pool.close();
}
