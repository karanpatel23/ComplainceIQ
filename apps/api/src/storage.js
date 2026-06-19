import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export class LocalPrivateStorage {
  constructor(config) {
    this.uploadDir = path.resolve(config.uploadDir);
    this.maxBytes = config.maxUploadMb * 1024 * 1024;
    this.backend = config.uploadStorageBackend;
    if (this.backend !== "local") {
      throw new Error(`${this.backend} storage is not implemented yet. Use local or add a private object-storage adapter.`);
    }
  }

  async saveBuffer(buffer, originalName = "artifact.bin") {
    if (buffer.byteLength > this.maxBytes) {
      const error = new Error(`File exceeds maximum upload size of ${Math.round(this.maxBytes / 1024 / 1024)} MB`);
      error.status = 400;
      throw error;
    }
    await mkdir(this.uploadDir, { recursive: true, mode: 0o700 });
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
    const fileReference = `${randomUUID()}${ext}`;
    const abs = this.safePath(fileReference);
    await writeFile(abs, buffer, { flag: "wx", mode: 0o600 });
    return {
      fileReference,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      backend: "local"
    };
  }

  async readBuffer(fileReference) {
    return readFile(this.safePath(fileReference));
  }

  async deleteBuffer(fileReference) {
    try {
      await unlink(this.safePath(fileReference));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  safePath(fileReference) {
    const abs = path.resolve(this.uploadDir, fileReference);
    const relative = path.relative(this.uploadDir, abs);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Invalid private file reference");
    }
    return abs;
  }
}

export function createPrivateStorage(config) {
  if (config.uploadStorageBackend === "local") return new LocalPrivateStorage(config);
  throw new Error(`${config.uploadStorageBackend} storage is not implemented. Configure a private storage adapter before starting the API.`);
}
