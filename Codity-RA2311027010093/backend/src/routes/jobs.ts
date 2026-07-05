import express from 'express';
import { body, validationResult, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { JobService } from '../services/jobService';
import logger from '../lib/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { queueId, status, limit = 20, offset = 0 } = req.query;

    const where: any = {};
    if (queueId) where.queueId = queueId as string;
    if (status) where.status = status as string;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { queue: true, worker: true },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ jobs, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (error) {
    logger.error('Failed to get jobs', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/',
  [
    body('queueId').isUUID(),
    body('jobType').isIn(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH']),
    body('payload').exists(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { queueId, jobType, payload, priority, scheduledFor } = req.body;

      const job = await JobService.createJob({
        queueId,
        jobType,
        payload,
        priority,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      });

      res.status(201).json(job);
    } catch (error) {
      logger.error('Failed to create job', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        queue: true,
        worker: true,
        executions: { orderBy: { createdAt: 'desc' } },
        logs: { orderBy: { timestamp: 'desc' } },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    logger.error('Failed to get job', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const retriedJob = await JobService.createJob({
      queueId: job.queueId,
      jobType: job.jobType,
      payload: job.payload,
      priority: job.priority,
    });

    logger.info('Job retried', { originalJobId: job.id, newJobId: retriedJob.id });
    res.status(201).json(retriedJob);
  } catch (error) {
    logger.error('Failed to retry job', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
