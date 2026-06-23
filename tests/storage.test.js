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

test("S3 private storage uses opaque keys and never exposes a public URL", async () => {
  const objects = new Map();
  const client = {
    async send(command) {
      if (command.constructor.name === "PutObjectCommand") {
        objects.set(command.input.Key, Buffer.from(command.input.Body));
        return {};
      }
      if (command.constructor.name === "GetObjectCommand") {
        const value = objects.get(command.input.Key);
        return { Body: { transformToByteArray: async () => value } };
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        objects.delete(command.input.Key);
        return {};
      }
      throw new Error("Unexpected command");
    }
  };
  const storage = createPrivateStorage({
    storageBackend: "s3",
    maxUploadMb: 1,
    s3Bucket: "private-bucket",
    s3Region: "ca-central-1",
    s3Endpoint: "",
    s3ForcePathStyle: false,
    s3AccessKeyId: "",
    s3SecretAccessKey: ""
  }, { s3Client: client });
  const saved = await storage.saveBuffer(Buffer.from("private object"), "record.pdf");
  assert.match(saved.fileReference, /^private\/[a-f0-9-]+\.pdf$/);
  assert.equal(saved.fileReference.includes("http"), false);
  assert.equal((await storage.readBuffer(saved.fileReference)).toString(), "private object");
  await assert.rejects(() => storage.readBuffer("../public/object"), /Invalid private object reference/);
  await storage.deleteBuffer(saved.fileReference);
  assert.equal(objects.size, 0);
});
