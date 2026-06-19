export async function createPostgresPool(databaseUrl, overrides = {}) {
  const pg = await import("pg");
  const Pool = pg.default?.Pool || pg.Pool;
  return new Pool({
    connectionString: databaseUrl,
    application_name: "complianceiq",
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
    ...overrides
  });
}
