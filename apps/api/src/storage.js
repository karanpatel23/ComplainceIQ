import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class LocalPrivateStorage {
  constructor(config) {
    this.uploadDir = path.resolve(config.uploadDir);
    this.maxBytes = config.maxUploadMb * 1024 * 1024;
    this.backend = "local";
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

  async healthCheck() {
    await mkdir(this.uploadDir, { recursive: true, mode: 0o700 });
    await access(this.uploadDir);
    return { ok: true, backend: this.backend };
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

export class S3PrivateStorage {
  constructor(config, client = null, presigner = getSignedUrl) {
    this.backend = "s3";
    this.bucket = config.s3Bucket;
    this.maxBytes = config.maxUploadMb * 1024 * 1024;
    this.signedUrlExpirySeconds = config.signedUrlExpirySeconds || 300;
    this.presigner = presigner;
    this.client = client || new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint || undefined,
      forcePathStyle: config.s3ForcePathStyle,
      credentials: config.s3AccessKeyId
        ? { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey }
        : undefined
    });
  }

  async saveBuffer(buffer, originalName = "artifact.bin") {
    if (buffer.byteLength > this.maxBytes) {
      const error = new Error(`File exceeds maximum upload size of ${Math.round(this.maxBytes / 1024 / 1024)} MB`);
      error.status = 400;
      throw error;
    }
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
    const fileReference = `private/${randomUUID()}${ext}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileReference,
      Body: buffer,
      ServerSideEncryption: "AES256"
    }));
    return {
      fileReference,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      backend: "s3"
    };
  }

  async readBuffer(fileReference) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.safeKey(fileReference) }));
    if (!response.Body) throw new Error("Private object storage returned an empty body");
    if (typeof response.Body.transformToByteArray === "function") return Buffer.from(await response.Body.transformToByteArray());
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async deleteBuffer(fileReference) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.safeKey(fileReference) }));
  }

  async healthCheck() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    return { ok: true, backend: this.backend };
  }

  async createSignedReadUrl(fileReference, expiresIn = this.signedUrlExpirySeconds) {
    if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3_600) {
      throw new Error("Signed URL expiry must be between 60 and 3600 seconds");
    }
    return this.presigner(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: this.safeKey(fileReference) }), { expiresIn });
  }

  safeKey(fileReference) {
    if (typeof fileReference !== "string" || !fileReference.startsWith("private/") || fileReference.includes("..") || fileReference.includes("\\")) {
      throw new Error("Invalid private object reference");
    }
    return fileReference;
  }
}

export function createPrivateStorage(config, options = {}) {
  const backend = config.storageBackend || config.uploadStorageBackend;
  if (backend === "local") return new LocalPrivateStorage(config);
  if (backend === "s3") return new S3PrivateStorage(config, options.s3Client, options.presigner);
  throw new Error(`${backend} storage is not implemented. Configure a private storage adapter before starting the API.`);
}
