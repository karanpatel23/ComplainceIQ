const role = process.argv[2];
if (!["api", "worker", "api-and-worker"].includes(role)) {
  throw new Error("Runtime role must be api, worker, or api-and-worker");
}
process.env.PROCESS_ROLE = role;
await import("../apps/api/src/server.js");
