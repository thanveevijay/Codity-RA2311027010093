import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { config } from '../config';
import logger from '../lib/logger';

const router = express.Router();

router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      });

      const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
        expiresIn: '7d',
      });

      logger.info('User registered', { userId: user.id });
      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      logger.error('Registration failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
        expiresIn: '7d',
      });

      logger.info('User logged in', { userId: user.id });
      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      logger.error('Login failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
