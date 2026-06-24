import { randomUUID } from "node:crypto";

export class LocalEvidenceProcessingQueue {
  constructor({
    repo,
    processor,
    concurrency = 1,
    maxRetries = 3,
    retryBaseMs = 1_000,
    leaseMs = 300_000,
    heartbeatMs = 30_000,
    pollMs = 1_000,
    shutdownTimeoutMs = 30_000,
    workerId = `local-${process.pid}-${randomUUID()}`,
    onEvent = null,
    logger = null,
    autoStart = true
  }) {
    this.repo = repo;
    this.processor = processor;
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.retryBaseMs = retryBaseMs;
    this.leaseMs = leaseMs;
    this.heartbeatMs = heartbeatMs;
    this.pollMs = pollMs;
    this.shutdownTimeoutMs = shutdownTimeoutMs;
    this.workerId = workerId;
    this.onEvent = onEvent;
    this.logger = logger;
    this.autoStart = autoStart;
    this.stopped = false;
    this.started = false;
    this.timer = null;
    this.drainPromise = null;
    this.activeJobs = new Set();
    this.counters = { claimed: 0, completed: 0, retries: 0, deadLettered: 0, leaseLost: 0, recovered: 0 };
  }

  async enqueue({ organizationId, facilityId, evidenceId, createdByUserId = null }) {
    const job = await this.repo.enqueueProcessingJob({ organizationId, facilityId, evidenceId, createdByUserId, maxAttempts: this.maxRetries });
    await this.emit("evidence_processing_queued", job, { duplicate: Boolean(job.duplicate) });
    if (this.autoStart) this.schedule(0);
    return job;
  }

  async drain() {
    if (this.drainPromise) return this.drainPromise;
    this.drainPromise = this.runDrain();
    try {
      return await this.drainPromise;
    } finally {
      this.drainPromise = null;
      if (this.autoStart && !this.stopped) this.schedule(this.pollMs);
    }
  }

  async runDrain() {
    const completed = [];
    while (!this.stopped) {
      const jobs = [];
      for (let index = 0; index < this.concurrency; index += 1) {
        const leaseToken = randomUUID();
        const job = await this.repo.claimNextProcessingJob({
          workerId: this.workerId,
          leaseToken,
          leaseExpiresAt: this.nextLeaseExpiry()
        });
        if (!job) break;
        this.counters.claimed += 1;
        jobs.push(job);
      }
      if (jobs.length === 0) break;
      completed.push(...await Promise.all(jobs.map((job) => this.process(job))));
    }
    return completed;
  }

  async process(job) {
    this.activeJobs.add(job.id);
    let heartbeatRunning = false;
    let leaseLost = false;
    const heartbeat = async () => {
      if (heartbeatRunning || leaseLost) return;
      heartbeatRunning = true;
      try {
        await this.repo.heartbeatProcessingJob(job.organizationId, job.id, {
          leaseToken: job.leaseToken,
          leaseExpiresAt: this.nextLeaseExpiry()
        });
      } catch (error) {
        leaseLost = error.code === "JOB_LEASE_LOST";
        this.log("error", "queue_heartbeat_failed", job, { errorCode: error.code || "QUEUE_HEARTBEAT_ERROR" });
      } finally {
        heartbeatRunning = false;
      }
    };
    const heartbeatTimer = setInterval(() => void heartbeat(), this.heartbeatMs);
    heartbeatTimer.unref?.();
    const startedAt = Date.now();
    this.log("info", "queue_job_started", job);
    try {
      const result = await this.processor(job);
      if (leaseLost) throw leaseLostError(job.id);
      const completed = await this.repo.completeProcessingJob(job.organizationId, job.id, job.leaseToken);
      this.counters.completed += 1;
      await this.emit("evidence_processing_job_completed", completed, { analysisId: result?.id || null, durationMs: Date.now() - startedAt });
      this.log("info", "queue_job_completed", completed, { durationMs: Date.now() - startedAt });
      return completed;
    } catch (error) {
      if (error.code === "JOB_LEASE_LOST") {
        this.counters.leaseLost += 1;
        await this.emit("evidence_processing_lease_lost", job, { errorCode: error.code });
        this.log("error", "queue_job_lease_lost", job, { durationMs: Date.now() - startedAt, errorCode: error.code });
        return { ...job, status: "lease_lost" };
      }
      const retryable = error.retryable !== false && job.processingAttempts < job.maxAttempts;
      const retryAt = retryable
        ? new Date(Date.now() + Math.min(this.retryBaseMs * (2 ** Math.max(0, job.processingAttempts - 1)), 30_000)).toISOString()
        : null;
      const failed = await this.repo.failProcessingJob(job.organizationId, job.id, { error: error.message, retryAt, leaseToken: job.leaseToken });
      if (retryable) this.counters.retries += 1;
      else this.counters.deadLettered += 1;
      await this.emit(retryable ? "evidence_processing_retry_scheduled" : "evidence_processing_dead_lettered", failed, {
        errorCode: error.code || "PROCESSING_ERROR",
        durationMs: Date.now() - startedAt
      });
      this.log(retryable ? "warn" : "error", retryable ? "queue_job_retry_scheduled" : "queue_job_dead_lettered", failed, {
        durationMs: Date.now() - startedAt,
        errorCode: error.code || "PROCESSING_ERROR"
      });
      if (retryAt && this.autoStart) this.schedule(Math.max(0, new Date(retryAt).getTime() - Date.now()));
      return failed;
    } finally {
      clearInterval(heartbeatTimer);
      this.activeJobs.delete(job.id);
    }
  }

  schedule(delayMs) {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain().catch((error) => this.log("error", "queue_drain_failed", null, { errorCode: error.code || "QUEUE_DRAIN_ERROR" }));
    }, delayMs);
    this.timer.unref?.();
  }

  async start() {
    this.stopped = false;
    this.started = true;
    const recovered = await this.repo.recoverStaleProcessingJobs?.(new Date().toISOString()) || [];
    this.counters.recovered += recovered.length;
    for (const job of recovered) await this.emit("evidence_processing_lease_recovered", job, { recoveredStatus: job.status });
    this.schedule(0);
  }

  async stop({ timeoutMs = this.shutdownTimeoutMs } = {}) {
    this.stopped = true;
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.drainPromise) return { drained: true, activeJobs: 0 };
    const drained = await Promise.race([
      this.drainPromise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
    ]);
    return { drained, activeJobs: this.activeJobs.size };
  }

  async healthCheck() {
    const persisted = await this.repo.getProcessingQueueMetrics?.() || {};
    return { ok: this.started && !this.stopped, backend: "local", workerId: this.workerId, activeJobs: this.activeJobs.size, persisted, counters: { ...this.counters } };
  }

  nextLeaseExpiry() {
    return new Date(Date.now() + this.leaseMs).toISOString();
  }

  async emit(action, job, metadata) {
    if (this.onEvent && job) await this.onEvent(action, job, metadata);
  }

  log(level, event, job, metadata = {}) {
    this.logger?.[level]?.(event, {
      workerId: this.workerId,
      jobId: job?.id,
      evidenceId: job?.evidenceId,
      facilityId: job?.facilityId,
      organizationId: job?.organizationId,
      processingStatus: job?.status,
      ...metadata
    });
  }
}

export function createEvidenceProcessingQueue(config, dependencies) {
  if (config.queueBackend !== "local") throw new Error(`Unsupported queue backend: ${config.queueBackend}`);
  return new LocalEvidenceProcessingQueue({
    ...dependencies,
    concurrency: config.queueConcurrency,
    maxRetries: config.queueMaxRetries,
    leaseMs: config.queueLeaseMs,
    heartbeatMs: config.queueHeartbeatMs,
    pollMs: config.queuePollMs,
    shutdownTimeoutMs: config.queueShutdownTimeoutMs
  });
}

function leaseLostError(id) {
  const error = new Error(`Processing job lease was lost for ${id}`);
  error.code = "JOB_LEASE_LOST";
  error.retryable = false;
  return error;
}
