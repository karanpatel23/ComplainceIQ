export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const repositoryBackend = env.REPOSITORY_BACKEND || (env.DATABASE_URL ? "postgres" : "file");
  const allowedOrigins = (env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && allowedOrigins.includes("*")) {
    throw new Error("ALLOWED_ORIGINS must not include * in production");
  }

  if (isProduction) {
    const required = ["PORT", "APP_URL", "ALLOWED_ORIGINS", "DATABASE_URL", "SESSION_SECRET", "UPLOAD_STORAGE_BACKEND", "UPLOAD_DIR", "MAX_UPLOAD_MB"];
    const missing = required.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  }

  if (repositoryBackend === "postgres" && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when REPOSITORY_BACKEND=postgres");
  }

  if (isProduction && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }

  if (isProduction && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    throw new Error("SESSION_SECRET is required in production and must be at least 32 characters");
  }

  if (isProduction && env.ENABLE_DEMO_DATA === "true") {
    throw new Error("ENABLE_DEMO_DATA must not be true in production");
  }

  const maxUploadMb = Number.parseInt(env.MAX_UPLOAD_MB || "25", 10);
  if (!Number.isInteger(maxUploadMb) || maxUploadMb <= 0) {
    throw new Error("MAX_UPLOAD_MB must be a positive integer");
  }

  return {
    nodeEnv,
    isProduction,
    port: Number.parseInt(env.PORT || "4000", 10),
    apiHost: env.API_HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
    appUrl: env.APP_URL || "http://localhost:5173",
    allowedOrigins,
    databaseUrl: env.DATABASE_URL || "",
    repositoryBackend,
    sessionSecret: env.SESSION_SECRET || "development-only-session-secret-change-me",
    uploadStorageBackend: env.UPLOAD_STORAGE_BACKEND || "local",
    uploadDir: env.UPLOAD_DIR || "data/private-storage",
    maxUploadMb,
    enableDemoData: env.ENABLE_DEMO_DATA === "true",
    adminEmail: env.ADMIN_EMAIL || "admin@complianceiq.local",
    adminPassword: env.ADMIN_PASSWORD || ""
  };
}
