import { readRepositoryConfig } from "../../config/src/index.js";
import { runMigrations } from "./migration-runner.js";
import { createPostgresPool } from "./postgres-pool.js";
import { loadMigrations } from "./repository.js";

const config = readRepositoryConfig(process.env);

if (config.repositoryBackend !== "postgres") {
  throw new Error("db:migrate requires REPOSITORY_BACKEND=postgres and DATABASE_URL");
}

const pool = await createPostgresPool(config.databaseUrl);

try {
  const applied = await runMigrations(pool, await loadMigrations());
  console.error(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database migrations are up to date.");
} finally {
  await pool.end();
}
