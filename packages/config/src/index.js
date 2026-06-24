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
    const required = ["PORT", "APP_URL", "ALLOWED_ORIGINS", "DATABASE_URL", "SESSION_SECRET", "STORAGE_BACKEND", "MAX_UPLOAD_MB"];
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
      const appUrl = new URL(env.APP_URL);
      const originUrls = allowedOrigins.map((origin) => new URL(origin));
      if (appUrl.protocol !== "https:" || originUrls.some((origin) => origin.protocol !== "https:")) throw new Error("HTTPS required");
    } catch {
      throw new Error("APP_URL and ALLOWED_ORIGINS must contain valid absolute HTTPS URLs in production");
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

  const storageBackend = env.STORAGE_BACKEND || env.UPLOAD_STORAGE_BACKEND || "local";
  if (!["local", "s3"].includes(storageBackend)) throw new Error("STORAGE_BACKEND must be local or s3");
  if (isProduction && storageBackend !== "s3") throw new Error("STORAGE_BACKEND must be s3 in production");
  if (storageBackend === "s3" && (!env.S3_BUCKET || !env.S3_REGION)) {
    throw new Error("S3_BUCKET and S3_REGION are required when STORAGE_BACKEND=s3");
  }
  if (Boolean(env.S3_ACCESS_KEY_ID) !== Boolean(env.S3_SECRET_ACCESS_KEY)) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together");
  }

  const queueBackend = env.QUEUE_BACKEND || "local";
  if (queueBackend !== "local") throw new Error("QUEUE_BACKEND currently supports local only");
  const queueConcurrency = boundedInteger(env.QUEUE_CONCURRENCY || "1", "QUEUE_CONCURRENCY", 1, 16);
  const queueMaxRetries = boundedInteger(env.QUEUE_MAX_RETRIES || "3", "QUEUE_MAX_RETRIES", 1, 10);
  const queueLeaseMs = boundedInteger(env.QUEUE_LEASE_MS || "300000", "QUEUE_LEASE_MS", 5_000, 3_600_000);
  const queueHeartbeatMs = boundedInteger(env.QUEUE_HEARTBEAT_MS || "30000", "QUEUE_HEARTBEAT_MS", 1_000, 300_000);
  const queuePollMs = boundedInteger(env.QUEUE_POLL_MS || "1000", "QUEUE_POLL_MS", 100, 60_000);
  const queueShutdownTimeoutMs = boundedInteger(env.QUEUE_SHUTDOWN_TIMEOUT_MS || "30000", "QUEUE_SHUTDOWN_TIMEOUT_MS", 1_000, 300_000);
  if (queueHeartbeatMs >= queueLeaseMs) throw new Error("QUEUE_HEARTBEAT_MS must be less than QUEUE_LEASE_MS");

  const malwareScanEnabled = env.MALWARE_SCAN_ENABLED === "true";
  const malwareScanRequiredInProduction = env.MALWARE_SCAN_REQUIRED_IN_PRODUCTION === "true";
  const malwareScannerProvider = env.MALWARE_SCANNER_PROVIDER || "mock";
  const malwareScanTimeoutMs = boundedInteger(env.MALWARE_SCAN_TIMEOUT_MS || "10000", "MALWARE_SCAN_TIMEOUT_MS", 100, 120_000);
  const malwareScanFailPolicy = env.MALWARE_SCAN_FAIL_POLICY || (isProduction ? "closed" : "open");
  const clamavHost = env.CLAMAV_HOST || "127.0.0.1";
  const clamavPort = boundedInteger(env.CLAMAV_PORT || "3310", "CLAMAV_PORT", 1, 65_535);
  if (!["mock", "clamav"].includes(malwareScannerProvider)) throw new Error("MALWARE_SCANNER_PROVIDER must be mock or clamav");
  if (!["open", "closed"].includes(malwareScanFailPolicy)) throw new Error("MALWARE_SCAN_FAIL_POLICY must be open or closed");
  if (isProduction && malwareScanEnabled && malwareScannerProvider === "mock") {
    throw new Error("MALWARE_SCANNER_PROVIDER=mock is not allowed in production");
  }
  if (isProduction && malwareScanRequiredInProduction && (!malwareScanEnabled || malwareScannerProvider !== "clamav" || malwareScanFailPolicy !== "closed")) {
    throw new Error("Production-required malware scanning needs an enabled non-mock scanner adapter");
  }

  const trustProxy = env.TRUST_PROXY === "true";
  const sessionCookieSameSite = (env.SESSION_COOKIE_SAME_SITE || (isProduction ? "None" : "Lax")).toLowerCase();
  if (!["lax", "strict", "none"].includes(sessionCookieSameSite)) throw new Error("SESSION_COOKIE_SAME_SITE must be Lax, Strict, or None");

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
    storageBackend,
    uploadStorageBackend: storageBackend,
    uploadDir: env.UPLOAD_DIR || "data/private-storage",
    maxUploadMb,
    s3Bucket: env.S3_BUCKET || "",
    s3Region: env.S3_REGION || "",
    s3Endpoint: env.S3_ENDPOINT || "",
    s3AccessKeyId: env.S3_ACCESS_KEY_ID || "",
    s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    signedUrlExpirySeconds: boundedInteger(env.SIGNED_URL_EXPIRY_SECONDS || "300", "SIGNED_URL_EXPIRY_SECONDS", 60, 3_600),
    queueBackend,
    queueConcurrency,
    queueMaxRetries,
    queueLeaseMs,
    queueHeartbeatMs,
    queuePollMs,
    queueShutdownTimeoutMs,
    malwareScanEnabled,
    malwareScanRequiredInProduction,
    malwareScannerProvider,
    malwareScanTimeoutMs,
    malwareScanFailPolicy,
    clamavHost,
    clamavPort,
    trustProxy,
    sessionCookieSameSite: sessionCookieSameSite[0].toUpperCase() + sessionCookieSameSite.slice(1),
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

function boundedInteger(value, name, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return parsed;
}
