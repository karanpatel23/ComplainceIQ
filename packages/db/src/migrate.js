import { readConfig } from "../../config/src/index.js";
import { loadInitialMigrationSql } from "./repository.js";

const config = readConfig(process.env);

if (config.repositoryBackend !== "postgres") {
  throw new Error("db:migrate requires REPOSITORY_BACKEND=postgres and DATABASE_URL");
}

const pg = await import("pg");
const Pool = pg.default?.Pool || pg.Pool;
const pool = new Pool({ connectionString: config.databaseUrl });

try {
  const sql = await loadInitialMigrationSql();
  await pool.query(sql);
  console.error("Migration 0001_initial.sql applied.");
} finally {
  await pool.end();
}
