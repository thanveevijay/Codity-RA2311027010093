import express from 'express';
import { body, validationResult, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import logger from '../lib/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const queues = await prisma.queue.findMany({
      include: {
        project: true,
        retryPolicy: true,
        _count: {
          select: {
            jobs: {
              where: {
                status: { in: ['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING'] },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const queuesWithStats = queues.map(queue => ({
      ...queue,
      pendingJobs: queue._count.jobs,
    }));

    res.json(queuesWithStats);
  } catch (error) {
    logger.error('Failed to get queues', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('projectId').isUUID(),
    body('priority').optional().isInt(),
    body('concurrencyLimit').optional().isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, projectId, priority = 0, concurrencyLimit = 5, retryPolicyId } = req.body;

      const queue = await prisma.queue.create({
        data: {
          name,
          description,
          projectId,
          priority,
          concurrencyLimit,
          retryPolicyId,
        },
        include: { project: true, retryPolicy: true },
      });

      logger.info('Queue created', { queueId: queue.id, name });
      res.status(201).json(queue);
    } catch (error) {
      logger.error('Failed to create queue', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const queue = await prisma.queue.findUnique({
      where: { id: req.params.id },
      include: { project: true, retryPolicy: true },
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json(queue);
  } catch (error) {
    logger.error('Failed to get queue', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/pause', async (req, res) => {
  try {
    const queue = await prisma.queue.update({
      where: { id: req.params.id },
      data: { isPaused: true },
    });

    logger.info('Queue paused', { queueId: queue.id });
    res.json(queue);
  } catch (error) {
    logger.error('Failed to pause queue', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/resume', async (req, res) => {
  try {
    const queue = await prisma.queue.update({
      where: { id: req.params.id },
      data: { isPaused: false },
    });

    logger.info('Queue resumed', { queueId: queue.id });
    res.json(queue);
  } catch (error) {
    logger.error('Failed to resume queue', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
