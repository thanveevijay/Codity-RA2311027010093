import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { JobService } from '../services/jobService';
import { config } from '../config';

export class Worker {
  private workerId: string;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activeJobs: Map<string, { abortController: AbortController }> = new Map();

  constructor(private name: string = `worker-${uuidv4().slice(0, 8)}`) {
    this.workerId = uuidv4();
  }

  async start() {
    logger.info('Starting worker', { workerId: this.workerId, name: this.name });
    this.isRunning = true;

    await this.registerWorker();
    this.startPolling();
    this.startHeartbeat();

    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  private async registerWorker() {
    await prisma.worker.create({
      data: {
        id: this.workerId,
        name: this.name,
        status: 'IDLE',
        lastHeartbeat: new Date(),
      },
    });
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.pollAndProcess();
    }, config.worker.pollIntervalMs);

    this.pollAndProcess();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.sendHeartbeat();
    }, config.worker.heartbeatIntervalMs);

    this.sendHeartbeat();
  }

  private async sendHeartbeat() {
    try {
      await prisma.worker.update({
        where: { id: this.workerId },
        data: {
          lastHeartbeat: new Date(),
          status: this.activeJobs.size > 0 ? 'BUSY' : 'IDLE',
        },
      });
    } catch (error) {
      logger.error('Failed to send heartbeat', { workerId: this.workerId, error });
    }
  }

  private async pollAndProcess() {
    try {
      const job = await JobService.claimJob(this.workerId);
      if (job) {
        logger.info('Processing job', { jobId: job.id, workerId: this.workerId });
        this.processJob(job);
      }
    } catch (error) {
      logger.error('Poll failed', { workerId: this.workerId, error });
    }
  }

  private async processJob(job: any) {
    const abortController = new AbortController();
    this.activeJobs.set(job.id, { abortController });

    let executionId: string | null = null;

    try {
      await prisma.worker.update({
        where: { id: this.workerId },
        data: { status: 'BUSY', currentJobId: job.id },
      });

      executionId = (await JobService.createExecution(job.id, this.workerId)).id;
      await JobService.updateJobStatus(job.id, 'RUNNING');
      await JobService.addLog(job.id, 'INFO', 'Job started');

      const result = await this.executeJob(job, abortController.signal);

      await JobService.completeExecution(executionId, 'COMPLETED', { output: result });
      await JobService.updateJobStatus(job.id, 'COMPLETED', { output: result });
      await JobService.addLog(job.id, 'INFO', 'Job completed successfully');

      logger.info('Job completed', { jobId: job.id });
    } catch (error: any) {
      logger.error('Job failed', { jobId: job.id, error: error.message });

      if (executionId) {
        await JobService.completeExecution(executionId, 'FAILED', { error: error.message });
      }

      await JobService.updateJobStatus(job.id, 'FAILED', { error: error.message });
      await JobService.addLog(job.id, 'ERROR', `Job failed: ${error.message}`);

      const retryPolicy = await prisma.retryPolicy.findFirst({
        where: { queues: { some: { id: job.queueId } } },
      });

      if (retryPolicy && job.retryCount < retryPolicy.maxRetries) {
        const delay = this.calculateRetryDelay(retryPolicy, job.retryCount);
        const scheduledFor = new Date(Date.now() + delay);

        await JobService.addLog(job.id, 'INFO', `Scheduling retry ${job.retryCount + 1}/${retryPolicy.maxRetries} in ${delay}ms`);
        
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'SCHEDULED',
            workerId: null,
            scheduledFor,
          },
        });
      } else {
        await JobService.moveToDeadLetter(job.id, `Max retries exceeded: ${error.message}`);
      }
    } finally {
      this.activeJobs.delete(job.id);

      try {
        await prisma.worker.update({
          where: { id: this.workerId },
          data: { status: 'IDLE', currentJobId: null },
        });
      } catch (e) {
        logger.error('Failed to update worker status', { error: e });
      }
    }
  }

  private calculateRetryDelay(policy: any, retryCount: number): number {
    let delay = policy.delayMs;

    switch (policy.strategy) {
      case 'LINEAR':
        delay = policy.delayMs * (retryCount + 1);
        break;
      case 'EXPONENTIAL':
        delay = policy.delayMs * Math.pow(policy.backoffFactor || 2, retryCount);
        break;
    }

    return Math.min(delay, policy.maxDelayMs || 30000);
  }

  private async executeJob(job: any, signal: AbortSignal): Promise<any> {
    await JobService.addLog(job.id, 'INFO', 'Executing job payload', { payload: job.payload });

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    if (Math.random() < 0.1) {
      throw new Error('Random job failure for testing');
    }

    return { processed: true, timestamp: new Date().toISOString() };
  }

  async gracefulShutdown() {
    logger.info('Graceful shutdown initiated', { workerId: this.workerId });
    this.isRunning = false;

    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    for (const [jobId, { abortController }] of this.activeJobs) {
      logger.info('Aborting job', { jobId });
      abortController.abort();
    }

    try {
      await prisma.worker.update({
        where: { id: this.workerId },
        data: { status: 'OFFLINE', shutdownAt: new Date() },
      });
    } catch (e) {
      logger.error('Failed to update worker status during shutdown', { error: e });
    }

    logger.info('Worker shutdown complete', { workerId: this.workerId });
    process.exit(0);
  }
}

const worker = new Worker();
worker.start();
