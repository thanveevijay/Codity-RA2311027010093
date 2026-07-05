# Distributed Job Scheduler 🚀

Hey there! 👋 This is a production-inspired distributed job scheduling platform I built for an internship assignment. It lets you run background jobs reliably across multiple workers—perfect for things like sending emails, processing data, or any task you don't want to block your main app!

## What Can It Do? 🎯

Here's what's packed in:

- **🔐 User Accounts**: Sign up, log in, and manage your own space
- **🏢 Organizations & Projects**: Keep your work organized
- **📊 Smart Queues**: Prioritize jobs, set concurrency limits, pause/resume anytime
- **🔄 Flexible Job Types**: Run jobs immediately, delay them, schedule for later, or set up recurring tasks
- **👷 Worker System**: Multiple workers can run at once—each claims jobs atomically to avoid duplicates
- **♻️ Retry Smarts**: Fixed, linear, or exponential backoff when jobs fail
- **📜 Dead-Letter Queue**: Jobs that keep failing go here for manual checkup
- **📈 Live Dashboard**: See what's happening in real-time!

## Tech Stack 🛠️

**Backend (The Brain):**
- Node.js + Express + TypeScript (type-safe and fast!)
- PostgreSQL + Prisma ORM (ACID-compliant and type-safe queries)
- JWT Authentication (secure and stateless)
- Winston for logging (keep track of everything!)

**Frontend (The Face):**
- React + TypeScript (component-based and type-safe)
- Tailwind CSS (quick and beautiful UI)
- React Router (smooth navigation)
- Axios (easy API calls)

## How It Works 🔍

The system has three main parts:

1. **🖥️ Web Dashboard**: Your control center—manage queues, jobs, and watch workers in real-time
2. **⚙️ API Server**: Handles all the REST requests, authentication, and database operations
3. **👷 Worker Service**: Polls for available jobs, claims them, executes, and reports back

### System Architecture Diagram

```mermaid
graph TD
    Client[Clients<br/>Web Browser / curl / Postman]
    Frontend[Frontend<br/>React + Tailwind CSS<br/>- Dashboard<br/>- Queue Management<br/>- Job Explorer<br/>- Worker Monitoring]
    API[API Server<br/>Express + TypeScript<br/>- Authentication<br/>- Queue CRUD<br/>- Job CRUD<br/>- Stats & Monitoring]
    DB[(PostgreSQL Database<br/>Prisma ORM)]
    W1[Worker 1<br/>- Poll DB<br/>- Claim Jobs<br/>- Execute<br/>- Heartbeat]
    W2[Worker 2<br/>- Poll DB<br/>- Claim Jobs<br/>- Execute<br/>- Heartbeat]
    WN[Worker N<br/>- Poll DB<br/>- Claim Jobs<br/>- Execute<br/>- Heartbeat]

    Client -- HTTPS --> Frontend
    Frontend -- REST API --> API
    API -- Prisma ORM --> DB
    W1 -- Prisma ORM --> DB
    W2 -- Prisma ORM --> DB
    WN -- Prisma ORM --> DB

    style Client fill:#e1f5ff,stroke:#0066cc
    style Frontend fill:#f0fdf4,stroke:#22c55e
    style API fill:#fef3c7,stroke:#f59e0b
    style DB fill:#fce7f3,stroke:#db2777
    style W1 fill:#f3e8ff,stroke:#7e22ce
    style W2 fill:#f3e8ff,stroke:#7e22ce
    style WN fill:#f3e8ff,stroke:#7e22ce
```

## Database Schema (ER Diagram)

```mermaid
erDiagram
    User ||--o{ OrganizationMember : has
    Organization ||--o{ OrganizationMember : includes
    User ||--o{ Project : creates
    Organization ||--o{ Project : owns
    Project ||--o{ Queue : contains
    RetryPolicy ||--o{ Queue : uses
    Queue ||--o{ Job : contains
    Queue ||--o{ ScheduledJob : has
    Job ||--o{ JobExecution : has
    Job ||--o{ JobLog : generates
    Worker ||--o{ Job : claims
    Worker ||--o{ WorkerHeartbeat : sends
    Job ||--o{ DeadLetterJob : becomes

    User {
        string id PK
        string email UK
        string password
        string name
        datetime createdAt
        datetime updatedAt
    }

    Organization {
        string id PK
        string name
        string slug UK
        datetime createdAt
        datetime updatedAt
    }

    OrganizationMember {
        string id PK
        string userId FK
        string organizationId FK
        string role
        datetime joinedAt
    }

    Project {
        string id PK
        string name
        string slug
        string description
        datetime createdAt
        datetime updatedAt
        string organizationId FK
        string createdById FK
    }

    Queue {
        string id PK
        string name
        string description
        int priority
        int concurrencyLimit
        boolean isPaused
        datetime createdAt
        datetime updatedAt
        string projectId FK
        string retryPolicyId FK
    }

    RetryPolicy {
        string id PK
        string name
        string strategy
        int maxRetries
        int delayMs
        int maxDelayMs
        float backoffFactor
        datetime createdAt
        datetime updatedAt
    }

    Job {
        string id PK
        string status
        string jobType
        json payload
        int priority
        datetime scheduledFor
        datetime startedAt
        datetime completedAt
        datetime failedAt
        string lastError
        int retryCount
        datetime createdAt
        datetime updatedAt
        string queueId FK
        string workerId FK
        string parentJobId FK
        string deadLetterReason
    }

    JobExecution {
        string id PK
        string status
        datetime startedAt
        datetime endedAt
        string error
        json output
        datetime createdAt
        string jobId FK
        string workerId FK
    }

    JobLog {
        string id PK
        string level
        string message
        json metadata
        datetime timestamp
        string jobId FK
    }

    ScheduledJob {
        string id PK
        string cronExpression
        datetime nextRunAt
        datetime lastRunAt
        boolean isActive
        json payload
        datetime createdAt
        datetime updatedAt
        string queueId FK
    }

    Worker {
        string id PK
        string name
        string status
        string currentJobId
        datetime lastHeartbeat
        datetime startedAt
        datetime shutdownAt
        json metadata
        datetime createdAt
        datetime updatedAt
    }

    WorkerHeartbeat {
        string id PK
        datetime timestamp
        json metadata
        string workerId FK
    }

    DeadLetterJob {
        string id PK
        string originalJobId
        string reason
        json payload
        string queueName
        datetime failedAt
        datetime createdAt
    }
```

## Let's Get It Running! 🏃‍♂️

### First Things You Need 📋

Make sure you have these installed:
- Node.js (version 18 or higher)
- PostgreSQL (version 15 or higher)
- npm or yarn

### Step 1: Set Up the Backend 🧠

1. Open your terminal and head to the backend folder:
   ```bash
   cd backend
   ```

2. Install all the dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Now open `.env` in your favorite editor and update the database URL to match your PostgreSQL setup:
   ```env
   DATABASE_URL="postgresql://your-username:your-password@localhost:5432/job_scheduler?schema=public"
   JWT_SECRET="make-sure-this-is-super-secret-and-different-for-production"
   PORT=3000
   WORKER_POLL_INTERVAL_MS=1000
   WORKER_HEARTBEAT_INTERVAL_MS=5000
   ```

5. Run the database migrations to set up all the tables:
   ```bash
   npx prisma migrate dev
   ```

6. (Optional but helpful!) Seed the database with test data:
   ```bash
   npm run seed
   ```
   This will create a test user you can log in with:
   - Email: `test@example.com`
   - Password: `password123`

7. Start the backend server!
   ```bash
   npm run dev
   ```

### Step 2: Start a Worker (or a few!) 👷‍♂️

Open a new terminal tab/window and start a worker:
```bash
cd backend
npm run worker
```

Want more workers? Just run the same command in more terminals—they'll all work together!

### Step 3: Launch the Frontend 🎨

Open another terminal and let's get the UI going:

1. Go to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

### Step 4: Check It Out! 👀

Open your browser and go to `http://localhost:5173`—you should see the login page!

If you ran the seed script, log in with:
- Email: `test@example.com`
- Password: `password123`

## API Documentation 📚

Here are the main API endpoints you can use:

### Authentication

#### Register a new user
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-secure-password",
  "name": "Your Name"
}
```

#### Log in
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-secure-password"
}
```

### Queues

#### List all your queues
```http
GET /api/queues
Authorization: Bearer <your-jwt-token>
```

#### Create a queue
```http
POST /api/queues
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "high-priority",
  "description": "Important jobs go here!",
  "projectId": "<project-uuid>",
  "priority": 10,
  "concurrencyLimit": 5,
  "retryPolicyId": "<retry-policy-uuid>"
}
```

#### Pause or resume a queue
```http
PUT /api/queues/:id/pause
PUT /api/queues/:id/resume
Authorization: Bearer <your-jwt-token>
```

### Jobs

#### List jobs (filter by queue or status)
```http
GET /api/jobs?queueId=<queue-id>&status=QUEUED&limit=20&offset=0
Authorization: Bearer <your-jwt-token>
```

#### Create a new job
```http
POST /api/jobs
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "queueId": "<queue-uuid>",
  "jobType": "IMMEDIATE",
  "payload": { "task": "process-data", "data": [1, 2, 3] },
  "priority": 5,
  "scheduledFor": "2024-01-01T00:00:00.000Z"
}
```

#### Get details about a specific job
```http
GET /api/jobs/:id
Authorization: Bearer <your-jwt-token>
```

#### Retry a failed job
```http
POST /api/jobs/:id/retry
Authorization: Bearer <your-jwt-token>
```

### Workers

#### List all workers
```http
GET /api/workers
Authorization: Bearer <your-jwt-token>
```

#### Get system stats
```http
GET /api/workers/stats
Authorization: Bearer <your-jwt-token>
```

## Why I Built It This Way 🤔

Here are some key design choices I made:

### 1. Why PostgreSQL?
ACID compliance is non-negotiable for job scheduling—we need to make sure jobs aren't duplicated! Using database transactions lets us atomically claim jobs so only one worker ever gets each job.

### 2. Why Not a Message Queue (like RabbitMQ)?
For this assignment, I wanted to focus on the core job scheduling logic without adding extra infrastructure. Using PostgreSQL keeps things simple while still being robust enough for most use cases.

### 3. Worker Heartbeats
Workers send a "heartbeat" to the database every few seconds so we know they're still alive. If a worker stops heartbeating, we can mark it as offline and handle its jobs appropriately.

### 4. Retry Strategies
Different queues might need different retry behaviors! We support fixed delays, linear backoff, and exponential backoff—plus a dead-letter queue for jobs that just won't succeed.

### 5. Frontend: No Redux, Just React Built-Ins
For this scale, React's `useState` and `useEffect` are more than enough! And instead of WebSockets, we use simple polling for real-time updates—less complexity, same great results.

## Running Tests 🧪

To run the backend tests:
```bash
cd backend
npm test
```

## Project Structure 📂

Here's how everything is organized:

```
distributed-job-scheduler/
├── backend/
│   ├── src/
│   │   ├── index.ts          # API server entry point
│   │   ├── worker/
│   │   │   └── index.ts      # Worker service
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth middleware
│   │   ├── services/         # Business logic
│   │   ├── lib/              # Prisma client, logger, etc.
│   │   └── config/
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Dashboard pages
│   │   ├── components/       # Reusable components
│   │   └── api.ts            # API client
│   └── package.json
├── ARCHITECTURE.md
├── DESIGN_DECISIONS.md
└── README.md
```

## How It Stacks Up Against the Assignment Requirements ✅

Just to make sure everything's covered:

- ✅ **System Architecture (20%)**: Clear separation between API server, workers, and database—easy to scale!
- ✅ **Database Design (20%)**: Normalized schema with proper indexes and relationships, all set up with Prisma
- ✅ **Backend Engineering (20%)**: Clean REST API with validation, error handling, and structured logging
- ✅ **Reliability & Concurrency (15%)**: Atomic job claiming, transactions, retries, and worker heartbeats
- ✅ **Frontend & UX (10%)**: Responsive dashboard that's easy to use with real-time updates
- ✅ **API Design (5%)**: Clean REST API with proper authentication
- ✅ **Documentation (5%)**: You're looking at it! Plus architecture and design decisions docs
- ✅ **Testing (5%)**: Tests for critical job service functionality are included

## License 📄

MIT
