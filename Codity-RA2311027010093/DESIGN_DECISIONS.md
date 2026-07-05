# Design Decisions

This document explains the major architectural and design decisions made for this project.

## 1. Tech Stack Selection

### Backend: Node.js + Express + TypeScript
- **Why Node.js?** Non-blocking I/O makes it well-suited for job scheduling workloads
- **Why Express?** Minimal, flexible, and widely adopted - perfect for building REST APIs
- **Why TypeScript?** Type safety catches bugs early and improves code maintainability

### Database: PostgreSQL + Prisma
- **Why PostgreSQL?** ACID compliance is essential for atomic job claiming
- **Why Prisma?** Type-safe database access, excellent migration tooling, and great developer experience

### Frontend: React + TypeScript + Tailwind
- **Why React?** Component-based architecture and large ecosystem
- **Why Tailwind?** Rapid UI development with utility-first CSS
- **Why TypeScript?** Same type safety benefits as backend

## 2. Job Claiming Strategy: Atomic Database Update

### Problem
Multiple workers could claim the same job, leading to duplicate execution.

### Solution
Use database transactions to ensure atomic job claiming:

1. Find a job that's `QUEUED` or `SCHEDULED` (and due)
2. Update its status to `CLAIMED` and assign the worker ID
3. All in a single transaction

```typescript
await prisma.$transaction(async (tx) => {
  const job = await tx.job.findFirst({ /* ... */ });
  if (!job) return null;
  
  return tx.job.update({
    where: { id: job.id, status: { in: ['QUEUED', 'SCHEDULED'] } },
    data: { status: 'CLAIMED', workerId }
  });
});
```

### Alternative Considered
- **Redis with distributed locks**: Would add complexity, not needed for this scope
- **Message queue (RabbitMQ, Kafka)**: Overkill for the assignment goals

## 3. Worker Heartbeats

### Problem
Workers can fail, leaving jobs in `CLAIMED` or `RUNNING` state indefinitely.

### Solution
Workers send periodic heartbeats to the database:

1. Each worker updates `lastHeartbeat` every X seconds
2. Workers without recent heartbeats are considered offline
3. Their jobs can be re-queued (not implemented in this version but designed for)

### Design Choice
- **Heartbeat interval**: 5 seconds
- **Considered offline**: After 30 seconds without heartbeat
- **Status**: IDLE when no active jobs, BUSY when processing

## 4. Retry Policies

### Strategies Implemented
1. **Fixed Delay**: Same delay between retries (e.g., 1 second)
2. **Linear Backoff**: Delay increases linearly (e.g., 1s, 2s, 3s)
3. **Exponential Backoff**: Delay doubles each time (e.g., 1s, 2s, 4s, 8s)

### Configuration
- Stored in `RetryPolicy` table
- Linked to queues (one policy per queue)
- Includes `maxRetries`, `delayMs`, `maxDelayMs`, `backoffFactor`

### Dead-Letter Queue
- Jobs exceeding max retries are moved to `DeadLetterJob`
- Original job marked as `DEAD_LETTER`
- Preserves all original information for debugging

## 5. Job State Machine

```
QUEUED
  │
  ├─→ SCHEDULED (if scheduled for future)
  │     │
  │     └─→ QUEUED (when due)
  │
  ├─→ CLAIMED (when worker picks it up)
  │     │
  │     └─→ RUNNING
  │           │
  │           ├─→ COMPLETED (success)
  │           └─→ FAILED (failure)
  │                 │
  │                 ├─→ QUEUED/SCHEDULED (retry)
  │                 └─→ DEAD_LETTER (max retries exceeded)
  │
  └─→ DEAD_LETTER (direct, e.g., invalid payload)
```

## 6. Queue Prioritization

### How It Works
- Each queue has a `priority` field (higher = more important)
- Each job can also override with its own `priority`
- When selecting jobs, order by:
  1. Job priority (descending)
  2. Created at (ascending) - FIFO within same priority

### Concurrency Limits
- Each queue has `concurrencyLimit`
- Prevents a single queue from overwhelming the system
- Not strictly enforced in this version but tracked in DB

## 7. Authentication & Authorization

### Authentication
- JWT tokens (stateless)
- Tokens expire after 7 days
- Email + password login
- Passwords hashed with bcrypt

### Authorization
- Users belong to organizations
- Roles: ADMIN, MEMBER
- Projects belong to organizations
- Queues belong to projects
- (Role-based checks not fully implemented but schema supports it)

## 8. Frontend: Polling vs WebSockets

### Decision
Use polling instead of WebSockets for real-time updates.

### Reasoning
- **Simpler**: No need to manage WebSocket connections
- **Good enough**: 5-second polling is sufficient for this use case
- **Fewer edge cases**: No reconnection logic needed

### Trade-offs
- **Higher latency**: Updates not instantaneous
- **More requests**: But acceptable for the scale
- **Verdict**: Right choice for this assignment

## 9. Database Schema Design

### Normalization
- Fully normalized to 3NF
- Separate tables for each entity type
- Foreign keys with cascading deletes

### Indexes
- Index on frequently filtered columns:
  - `Job.status`, `Job.queueId`, `Job.scheduledFor`, `Job.priority`
  - `Worker.lastHeartbeat`, `Worker.status`
  - `Queue.isPaused`, `Queue.projectId`

### JSON Fields
- `Job.payload`: Flexible JSON for job data
- `JobLog.metadata`: Structured log metadata
- Trade-off: Querying inside JSON is less efficient, but flexibility is worth it

## 10. No Framework Lock-In

### Decision
Keep dependencies minimal.

### Rationale
- Express instead of NestJS: Simpler for this scope
- No Redux/state management library: React built-ins enough
- No job queue library: Implement core logic ourselves to demonstrate understanding

## Summary of Key Trade-offs

| Decision | Pros | Cons |
|----------|------|------|
| PostgreSQL for job claiming | ACID compliance, no extra infrastructure | Less scalable than dedicated MQ |
| Polling instead of WebSockets | Simpler implementation | Higher latency |
| Custom worker instead of BullMQ | Demonstrates understanding | Less feature-rich |
| No frontend state library | Fewer dependencies | More boilerplate for complex state |

The decisions prioritize **simplicity**, **demonstrating core concepts**, and **maintainability** over maximum scalability. This aligns with the assignment's goal of evaluating engineering quality over feature count.
