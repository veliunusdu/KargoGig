# KargoGig Rebuild Roadmap

This roadmap is designed to guide you through rebuilding KargoGig from scratch, focusing on **scalability (1000+ users)**, **reliability**, and **maintainability** for a solo developer.

## Phase 1: The Foundation (Days 1-2)
**Goal:** A solid, error-free development environment that mirrors production.

1.  **Initialize Project:**
    -   Create a new NestJS project: `nest new kargogig-backend`.
    -   **Strict Mode:** Enable `strict: true` in `tsconfig.json`.
    -   **Linter:** Configure ESLint + Prettier immediately.
2.  **Docker Setup:**
    -   Create `docker-compose.yml`.
    -   Services: `app` (Node), `redis` (Cache/PubSub), `postgres` (Local DB/Supabase).
    -   Ensure the app connects to Redis/Postgres via environment variables (`.env`).
3.  **Core Utilities:**
    -   Install `nestjs-pino` for structured JSON logging.
    -   Install `@nestjs/config` for strict env validation (use `joi` or `zod`).
    -   Create a `CommonModule` for shared logic (filters, interceptors).

## Phase 2: Authentication & Database (Days 3-4)
**Goal:** Secure user management using Supabase.

1.  **Supabase Integration:**
    -   Install `@supabase/supabase-js`.
    -   Create a `SupabaseModule` (Global) that exports the client.
    -   **Guard:** Implement `SupabaseAuthGuard` using `passport-jwt` strategy. Verify the JWT token signature locally (fast) or via Supabase Auth API (slower).
2.  **User Profiles:**
    -   Create `UsersModule`.
    -   Implement "Profile Sync": When a user signs up (via Supabase Auth hook or first API call), ensure a record exists in your public `profiles` table.

## Phase 3: The Real-Time Engine (Days 5-7)
**Goal:** Handle 1000 concurrent drivers without crashing the DB.

1.  **Redis Module:**
    -   Install `ioredis`.
    -   Create a `RedisService` to handle connection and error handling.
2.  **Socket Gateway:**
    -   Install `@nestjs/platform-socket.io` and `@nestjs/websockets`.
    -   Create `TrackingGateway`.
    -   Implement `Authentication` for sockets (validate JWT on connection handshake).
3.  **Location Ingestion:**
    -   **Event:** `updateLocation(lat, lng, heading)`.
    -   **Action:**
        -   `Redis.geoadd('drivers:locations', lng, lat, driverId)`
        -   `Redis.set('driver:data:' + driverId, JSON.stringify({...}))` (TTL: 60s)
        -   `Redis.publish('tracking:updates', ...)` (for consumers)
4.  **Live Monitoring:**
    -   Create an endpoint/socket event for Customers to subscribe to a specific driver's location (subscribe to Redis channel).

## Phase 4: Business Logic - Rides & Matching (Week 2)
**Goal:** The core ride-hailing loop.

1.  **Ride State Machine:**
    -   Define strict states: `SEARCHING` -> `OFFERED` -> `ACCEPTED` -> `ARRIVED` -> `IN_PROGRESS` -> `COMPLETED`.
    -   Use a library like `xstate` or a simple Switch/Case service to enforce transitions.
2.  **Matching Algorithm:**
    -   **Drivers:** Query Redis (`GEORADIUS`) for active drivers nearby (much faster than PostGIS for high frequency).
    -   **Pricing:** Calculate estimated price.
    -   **Offers:** Create an "Offer" record in Redis (TTL: 30s) and notify drivers via WebSocket/Push.
3.  **Order Management:**
    -   Once a ride is `ACCEPTED`, move the state to Postgres (Source of Truth).
    -   Only purely ephemeral data (live path) stays in Redis until the ride ends.

## Phase 5: Reliability & Background Jobs (Week 3)
**Goal:** Handle failures gracefully.

1.  **Queue System (BullMQ):**
    -   Install `@nestjs/bullmq`.
    -   **Queues:** `notifications`, `payments`, `webhooks`.
2.  **Notifications:**
    -   Move Expo Push logic to a `notification-worker`.
    -   If Expo is down, BullMQ will retry automatically.
3.  **Data Persistence:**
    -   Create a "Trip Archiver" job. When a ride completes, dump the Redis path history into a PostGIS `LineString` for permanent storage.

## Phase 6: Testing & Deployment (Week 4)
**Goal:** Production ready.

1.  **Testing:**
    -   **Unit:** Jest for Services.
    -   **E2E:** Supertest + Testcontainers (spin up real Redis/Postgres) for Controller testing.
2.  **CI/CD:**
    -   GitHub Actions: Lint -> Build -> Test -> Deploy.
3.  **Deployment:**
    -   Deploy to a VPS (DigitalOcean/Hetzner) using `docker compose` or a Platform (Render/Railway).
