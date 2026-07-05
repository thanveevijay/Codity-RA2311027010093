import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
    },
  });

  console.log('Created user:', user.email);

  // Create an organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      slug: 'test-org',
      members: {
        create: {
          userId: user.id,
          role: 'ADMIN',
        },
      },
    },
  });

  console.log('Created organization:', organization.name);

  // Create a project
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      slug: 'test-project',
      description: 'A test project',
      organizationId: organization.id,
      createdById: user.id,
    },
  });

  console.log('Created project:', project.name);

  // Create a retry policy
  const retryPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Standard Retry Policy',
      strategy: 'EXPONENTIAL',
      maxRetries: 3,
      delayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2.0,
    },
  });

  console.log('Created retry policy:', retryPolicy.name);

  // Create queues
  const queues = await Promise.all([
    prisma.queue.create({
      data: {
        name: 'High Priority',
        description: 'High priority jobs',
        priority: 10,
        concurrencyLimit: 3,
        projectId: project.id,
        retryPolicyId: retryPolicy.id,
      },
    }),
    prisma.queue.create({
      data: {
        name: 'Default',
        description: 'Default queue',
        priority: 5,
        concurrencyLimit: 5,
        projectId: project.id,
        retryPolicyId: retryPolicy.id,
      },
    }),
    prisma.queue.create({
      data: {
        name: 'Low Priority',
        description: 'Low priority jobs',
        priority: 1,
        concurrencyLimit: 2,
        projectId: project.id,
        retryPolicyId: retryPolicy.id,
      },
    }),
  ]);

  console.log('Created queues:', queues.map(q => q.name));

  // Create some test jobs
  for (let i = 0; i < 5; i++) {
    const queue = queues[i % queues.length];
    await prisma.job.create({
      data: {
        queueId: queue.id,
        jobType: 'IMMEDIATE',
        payload: { task: 'test', index: i },
        priority: queue.priority,
        status: 'QUEUED',
      },
    });
  }

  console.log('Created test jobs');

  console.log('Seeding complete!');
  console.log('Login with:', user.email, '/ password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
