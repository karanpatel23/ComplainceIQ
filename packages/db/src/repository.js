import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { FileRepository } from "./file-repository.js";
import { PostgresRepository } from "./postgres-repository.js";
export { nowIso } from "./time.js";

export async function createRepository(config) {
  if (config.repositoryBackend === "postgres") {
    const repo = new PostgresRepository(config.databaseUrl);
    await repo.init();
    return repo;
  }
  if (config.isProduction) {
    throw new Error("File repository is not allowed in production");
  }
  const repo = new FileRepository(process.env.FILE_REPOSITORY_PATH || "data/dev-db.json");
  await repo.init();
  return repo;
}

export async function loadInitialMigrationSql() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return readFile(path.resolve(here, "../migrations/0001_initial.sql"), "utf8");
}
