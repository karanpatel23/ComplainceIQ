export function readRepositoryConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const repositoryBackend = env.REPOSITORY_BACKEND || (env.DATABASE_URL ? "postgres" : "file");

  if (!["postgres", "file"].includes(repositoryBackend)) {
    throw new Error("REPOSITORY_BACKEND must be postgres or file");
  }

  if (repositoryBackend === "postgres" && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when REPOSITORY_BACKEND=postgres");
  }

  if (isProduction && repositoryBackend !== "postgres") {
    throw new Error("REPOSITORY_BACKEND must be postgres in production");
  }

  return {
    nodeEnv,
    isProduction,
    repositoryBackend,
    databaseUrl: env.DATABASE_URL || ""
  };
}

export function readConfig(env = process.env) {
  const repositoryConfig = readRepositoryConfig(env);
  const { nodeEnv, isProduction, repositoryBackend } = repositoryConfig;
  const allowedOrigins = (env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction) {
    const required = ["PORT", "APP_URL", "ALLOWED_ORIGINS", "DATABASE_URL", "SESSION_SECRET", "UPLOAD_STORAGE_BACKEND", "UPLOAD_DIR", "MAX_UPLOAD_MB"];
    const missing = required.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  }

  const port = Number.parseInt(env.PORT || "4000", 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  if (isProduction && allowedOrigins.includes("*")) {
    throw new Error("ALLOWED_ORIGINS must not include * in production");
  }

  if (isProduction) {
    try {
      new URL(env.APP_URL);
      for (const origin of allowedOrigins) new URL(origin);
    } catch {
      throw new Error("APP_URL and ALLOWED_ORIGINS must contain valid absolute URLs in production");
    }
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

  const aiEnabled = env.AI_ENABLED === "true";
  const aiProvider = env.AI_PROVIDER || "openai";
  const aiMaxFileTextChars = positiveInteger(env.AI_MAX_FILE_TEXT_CHARS || "12000", "AI_MAX_FILE_TEXT_CHARS");
  const aiConfidenceThreshold = unitInterval(env.AI_CONFIDENCE_THRESHOLD || "0.8", "AI_CONFIDENCE_THRESHOLD");
  const aiReviewRequiredThreshold = unitInterval(env.AI_REVIEW_REQUIRED_THRESHOLD || "0.7", "AI_REVIEW_REQUIRED_THRESHOLD");
  if (aiReviewRequiredThreshold > aiConfidenceThreshold) {
    throw new Error("AI_REVIEW_REQUIRED_THRESHOLD must be less than or equal to AI_CONFIDENCE_THRESHOLD");
  }
  if (aiEnabled && !["openai", "mock"].includes(aiProvider)) {
    throw new Error("AI_PROVIDER must be openai or mock when AI is enabled");
  }
  if (isProduction && aiEnabled && aiProvider === "mock") {
    throw new Error("AI_PROVIDER=mock is not allowed in production");
  }
  if (aiEnabled && aiProvider === "openai" && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) {
    throw new Error("OPENAI_API_KEY and OPENAI_MODEL are required when AI_ENABLED=true and AI_PROVIDER=openai");
  }

  return {
    nodeEnv,
    isProduction,
    port,
    apiHost: env.API_HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
    appUrl: env.APP_URL || "http://localhost:5173",
    allowedOrigins,
    databaseUrl: repositoryConfig.databaseUrl,
    repositoryBackend,
    sessionSecret: env.SESSION_SECRET || "development-only-session-secret-change-me",
    uploadStorageBackend: env.UPLOAD_STORAGE_BACKEND || "local",
    uploadDir: env.UPLOAD_DIR || "data/private-storage",
    maxUploadMb,
    enableDemoData: env.ENABLE_DEMO_DATA === "true",
    adminEmail: env.ADMIN_EMAIL || "admin@complianceiq.local",
    adminPassword: env.ADMIN_PASSWORD || "",
    aiEnabled,
    aiProvider,
    aiMaxFileTextChars,
    aiConfidenceThreshold,
    aiReviewRequiredThreshold,
    openAiApiKey: env.OPENAI_API_KEY || "",
    openAiModel: env.OPENAI_MODEL || ""
  };
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function unitInterval(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1`);
  return parsed;
}
