import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
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

export async function loadMigrations() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(here, "../migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(files.map(async (file) => ({
    id: file.replace(/\.sql$/, ""),
    sql: await readFile(path.join(migrationsDir, file), "utf8")
  })));
}
