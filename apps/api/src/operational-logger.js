const SENSITIVE_KEY = /(authorization|cookie|secret|password|token|api.?key|prompt|raw|file.?content|document.?text|employee.?names?)/i;

export function createOperationalLogger({ service = "complianceiq-api", sink = process.stderr, level: minimumLevel = "info" } = {}) {
  const levels = { debug: 10, info: 20, warn: 30, error: 40 };
  const write = (level, event, fields = {}) => {
    if (levels[level] < levels[minimumLevel]) return;
    const record = sanitize({
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
      ...fields
    });
    sink.write(`${JSON.stringify(record)}\n`);
  };
  return {
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields)
  };
}

export function sanitizeOperationalFields(value, key = "") {
  return sanitize(value, key);
}

function sanitize(value, key = "") {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 500).replace(/[\r\n\t]+/g, " ");
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, key));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([field]) => !SENSITIVE_KEY.test(field))
      .map(([field, item]) => [field, sanitize(item, field)]));
  }
  return String(value).slice(0, 500);
}
