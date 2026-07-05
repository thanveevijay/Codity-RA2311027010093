import express from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import logger from '../lib/logger';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: { organization: true, createdBy: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    logger.error('Failed to get projects', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
