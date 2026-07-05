import prisma from '../lib/prisma';
import logger from '../lib/logger';

export class JobService {
  static async createJob(data: {
    queueId: string;
    jobType: string;
    payload: any;
    priority?: number;
    scheduledFor?: Date;
  }) {
    const { queueId, jobType, payload, priority = 0, scheduledFor } = data;

    const job = await prisma.job.create({
      data: {
        queueId,
        jobType,
        payload,
        priority,
        scheduledFor,
        status: scheduledFor && scheduledFor > new Date() ? 'SCHEDULED' : 'QUEUED',
      },
    });

    logger.info('Job created', { jobId: job.id, queueId, jobType });
    return job;
  }

  static async claimJob(workerId: string) {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const availableQueues = await tx.queue.findMany({
        where: { isPaused: false },
      });

      const queueIds = availableQueues.map(q => q.id);
      if (queueIds.length === 0) return null;

      const job = await tx.job.findFirst({
        where: {
          queueId: { in: queueIds },
          status: { in: ['QUEUED', 'SCHEDULED'] },
          OR: [
            { scheduledFor: null },
            { scheduledFor: { lte: now } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      if (!job) return null;

      const claimedJob = await tx.job.update({
        where: { id: job.id, status: { in: ['QUEUED', 'SCHEDULED'] } },
        data: {
          status: 'CLAIMED',
          workerId,
        },
        include: { queue: true },
      });

      logger.info('Job claimed', { jobId: claimedJob.id, workerId });
      return claimedJob;
    });
  }

  static async updateJobStatus(
    jobId: string,
    status: string,
    data?: { error?: string; output?: any }
  ) {
    return await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        ...(status === 'RUNNING' && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(status === 'FAILED' && {
          failedAt: new Date(),
          lastError: data?.error,
          retryCount: { increment: 1 },
        }),
      },
    });
  }

  static async createExecution(jobId: string, workerId: string) {
    return await prisma.jobExecution.create({
      data: {
        jobId,
        workerId,
        status: 'RUNNING',
      },
    });
  }

  static async completeExecution(
    executionId: string,
    status: string,
    data?: { error?: string; output?: any }
  ) {
    return await prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status,
        endedAt: new Date(),
        error: data?.error,
        output: data?.output,
      },
    });
  }

  static async addLog(jobId: string, level: string, message: string, metadata?: any) {
    return await prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        metadata,
      },
    });
  }

  static async moveToDeadLetter(jobId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { queue: true },
      });

      if (!job) throw new Error('Job not found');

      await tx.deadLetterJob.create({
        data: {
          originalJobId: job.id,
          reason,
          payload: job.payload,
          queueName: job.queue.name,
          failedAt: new Date(),
        },
      });

      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'DEAD_LETTER',
          deadLetterReason: reason,
        },
      });

      logger.warn('Job moved to dead letter', { jobId, reason });
    });
  }
}
