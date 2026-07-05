import express from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import logger from '../lib/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });

    res.json(workers);
  } catch (error) {
    logger.error('Failed to get workers', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [totalJobs, completedJobs, failedJobs, pendingJobs, activeWorkers] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
      prisma.job.count({ where: { status: { in: ['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING'] } } }),
      prisma.worker.count({
        where: {
          lastHeartbeat: {
            gte: new Date(Date.now() - 30000),
          },
        },
      }),
    ]);

    res.json({
      totalJobs,
      completedJobs,
      failedJobs,
      pendingJobs,
      activeWorkers,
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
