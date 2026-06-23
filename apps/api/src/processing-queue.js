export class LocalEvidenceProcessingQueue {
  constructor({ repo, processor, concurrency = 1, maxRetries = 3, retryBaseMs = 1_000, onEvent = null, autoStart = true }) {
    this.repo = repo;
    this.processor = processor;
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.retryBaseMs = retryBaseMs;
    this.onEvent = onEvent;
    this.autoStart = autoStart;
    this.stopped = false;
    this.timer = null;
    this.drainPromise = null;
  }

  async enqueue({ organizationId, facilityId, evidenceId, createdByUserId = null }) {
    const job = await this.repo.enqueueProcessingJob({
      organizationId,
      facilityId,
      evidenceId,
      createdByUserId,
      maxAttempts: this.maxRetries
    });
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
    }
  }

  async runDrain() {
    const completed = [];
    while (!this.stopped) {
      const jobs = [];
      for (let index = 0; index < this.concurrency; index += 1) {
        const job = await this.repo.claimNextProcessingJob();
        if (!job) break;
        jobs.push(job);
      }
      if (jobs.length === 0) break;
      completed.push(...await Promise.all(jobs.map((job) => this.process(job))));
    }
    return completed;
  }

  async process(job) {
    try {
      const result = await this.processor(job);
      const completed = await this.repo.completeProcessingJob(job.organizationId, job.id);
      await this.emit("evidence_processing_job_completed", completed, { analysisId: result?.id || null });
      return completed;
    } catch (error) {
      const retryable = error.retryable !== false && job.processingAttempts < job.maxAttempts;
      const retryAt = retryable
        ? new Date(Date.now() + Math.min(this.retryBaseMs * (2 ** Math.max(0, job.processingAttempts - 1)), 30_000)).toISOString()
        : null;
      const failed = await this.repo.failProcessingJob(job.organizationId, job.id, { error: error.message, retryAt });
      await this.emit(retryable ? "evidence_processing_retry_scheduled" : "evidence_processing_job_failed", failed, {
        errorCode: error.code || "PROCESSING_ERROR"
      });
      if (retryAt && this.autoStart) this.schedule(Math.max(0, new Date(retryAt).getTime() - Date.now()));
      return failed;
    }
  }

  schedule(delayMs) {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain().catch((error) => process.stderr.write(`[ComplianceIQ worker] ${error.stack || error.message}\n`));
    }, delayMs);
    this.timer.unref?.();
  }

  async start() {
    this.stopped = false;
    await this.repo.recoverStaleProcessingJobs?.(new Date(Date.now() - 5 * 60 * 1_000).toISOString());
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async emit(action, job, metadata) {
    if (this.onEvent && job) await this.onEvent(action, job, metadata);
  }
}

export function createEvidenceProcessingQueue(config, dependencies) {
  if (config.queueBackend !== "local") throw new Error(`Unsupported queue backend: ${config.queueBackend}`);
  return new LocalEvidenceProcessingQueue({
    ...dependencies,
    concurrency: config.queueConcurrency,
    maxRetries: config.queueMaxRetries
  });
}
