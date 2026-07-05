# System Architecture

This document describes the overall architecture of the Distributed Job Scheduler.

## Overview

The system is composed of three main components:

1. **Web Dashboard** - React-based UI for managing the system
2. **API Server** - Express.js backend providing REST APIs
3. **Worker Service** - Node.js service that executes jobs
4. **Database** - PostgreSQL for storing all data

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                 │
│  (Web Browser, curl, Postman, etc.)                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Tailwind)                  │
│  - Dashboard                                                    │
│  - Queue management                                             │
│  - Job explorer                                                 │
│  - Worker monitoring                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Server (Express + TypeScript)             │
│  - Authentication (JWT)                                         │
│  - Queue CRUD                                                   │
│  - Job CRUD                                                     │
│  - Stats & monitoring                                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ Prisma ORM
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  - Users, Organizations, Projects                              │
│  - Queues, Retry Policies                                      │
│  - Jobs, Job Executions, Logs                                  │
│  - Workers, Heartbeats                                         │
│  - Dead Letter Queue                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Worker 1      │ │   Worker 2      │ │   Worker N      │
│  - Poll DB      │ │  - Poll DB      │ │  - Poll DB      │
│  - Claim jobs   │ │  - Claim jobs   │ │  - Claim jobs   │
│  - Execute      │ │  - Execute      │ │  - Execute      │
│  - Heartbeat    │ │  - Heartbeat    │ │  - Heartbeat    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Component Details

### 1. API Server

**Responsibilities:**
- Handle HTTP requests
- Authenticate users (JWT)
- Validate input
- Business logic
- Database operations
- Serve APIs for frontend

**Endpoints:**
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/queues` - List all queues
- `POST /api/queues` - Create a queue
- `PUT /api/queues/:id/pause` - Pause a queue
- `PUT /api/queues/:id/resume` - Resume a queue
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create a job
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/retry` - Retry a job
- `GET /api/workers` - List workers
- `GET /api/workers/stats` - Get system stats

### 2. Worker Service

**Responsibilities:**
- Poll database for available jobs
- Claim jobs atomically
- Execute job payloads
- Update job status
- Send heartbeats
- Handle retries
- Graceful shutdown

**Job Lifecycle (Worker View):**
1. Poll: Find a QUEUED or SCHEDULED (due) job
2. Claim: Atomically mark as CLAIMED and assign worker
3. Run: Mark as RUNNING, execute the job
4. Complete: On success, mark as COMPLETED
5. Fail: On error, mark as FAILED and handle retry
6. Repeat: Go back to polling

### 3. Database Design

**Core Tables:**

| Table | Purpose |
|-------|---------|
| `User` | System users (authentication) |
| `Organization` | Group users |
| `Project` | Group queues |
| `Queue` | Job queue configuration |
| `RetryPolicy` | Retry strategy |
| `Job` | Individual job |
| `JobExecution` | Each job run attempt |
| `JobLog` | Detailed logs |
| `Worker` | Worker instances |
| `WorkerHeartbeat` | Worker liveness |
| `DeadLetterJob` | Permanently failed |

**Index Strategy:**
- Index foreign keys for joins
- Index status columns for filtering
- Index timestamp columns for ordering
- Composite indexes for common queries

## Data Flow

### Creating a Job

```
User → Dashboard → API Server → Database (Job created as QUEUED)
```

### Executing a Job

```
Database (QUEUED job)
    ↓
Worker (polls and finds job)
    ↓
Database (transaction: mark as CLAIMED)
    ↓
Worker (executes job)
    ↓
Database (mark as COMPLETED/FAILED)
    ↓
(Optional: retry or dead letter)
```

## Key Design Patterns

### 1. Atomic Job Claiming
- Uses database transactions to prevent race conditions
- Only one worker can claim a job
- Prevents duplicate execution

### 2. Polling with Backoff
- Workers poll DB for jobs
- Simple to implement
- Good enough for this scale

### 3. Heartbeat for Liveness
- Workers update lastHeartbeat every 5s
- Workers without heartbeat for 30s considered dead
- Their jobs can be reclaimed

### 4. State Machine
Jobs transition through states:
```
QUEUED → CLAIMED → RUNNING → COMPLETED
            ↓
         FAILED → (retry or DEAD_LETTER)
```

## Scalability Considerations

### Current (Simple)
- Single PostgreSQL instance
- Workers poll DB directly
- Good for small to medium scale

### Future Improvements
- Add message queue (Redis, RabbitMQ)
- Connection pooling
- Read replicas for stats
- Cache frequent queries

## Security

- JWT authentication
- Passwords hashed with bcrypt
- Input validation with express-validator
- CORS configuration
- No secrets in code

## Reliability

- Atomic database operations
- Retry policies with backoff
- Dead letter queue for failed jobs
- Worker heartbeats for failure detection
- Graceful shutdown support
