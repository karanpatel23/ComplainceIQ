import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPrivateStorage } from "../apps/api/src/storage.js";

test("local private storage survives adapter reinitialization and blocks traversal", async () => {
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "ciq-storage-"));
  const config = { uploadStorageBackend: "local", uploadDir, maxUploadMb: 1 };
  const first = createPrivateStorage(config);
  const saved = await first.saveBuffer(Buffer.from("private evidence"), "evidence.txt");

  const restarted = createPrivateStorage(config);
  assert.equal((await restarted.readBuffer(saved.fileReference)).toString("utf8"), "private evidence");
  await assert.rejects(() => restarted.readBuffer("../outside.txt"), /Invalid private file reference/);
  await restarted.deleteBuffer(saved.fileReference);
  await assert.rejects(() => restarted.readBuffer(saved.fileReference), /ENOENT/);
});
