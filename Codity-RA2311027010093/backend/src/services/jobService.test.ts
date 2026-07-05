import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { JobService } from './jobService';

const prisma = new PrismaClient();

describe('JobService', () => {
  beforeEach(async () => {
    // Clean up before each test
    await prisma.job.deleteMany();
    await prisma.queue.deleteMany();
    await prisma.project.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      // Setup test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          name: 'Test User',
        },
      });

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: 'test-org',
          members: {
            create: { userId: user.id, role: 'ADMIN' },
          },
        },
      });

      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          slug: 'test-project',
          organizationId: org.id,
          createdById: user.id,
        },
      });

      const queue = await prisma.queue.create({
        data: {
          name: 'Test Queue',
          projectId: project.id,
        },
      });

      // Test createJob
      const job = await JobService.createJob({
        queueId: queue.id,
        jobType: 'IMMEDIATE',
        payload: { task: 'test' },
        priority: 5,
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe('QUEUED');
      expect(job.jobType).toBe('IMMEDIATE');
    });
  });
});

// Simple test for demonstration
describe('Basic Math', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('should multiply numbers correctly', () => {
    expect(2 * 3).toBe(6);
  });
});
