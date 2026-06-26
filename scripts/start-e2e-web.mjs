Object.assign(process.env, {
  WEB_PORT: "5174",
  WEB_HOST: "127.0.0.1",
  WEB_API_ORIGIN: "http://127.0.0.1:4100"
});

await import("../apps/web/src/static-server.js");
