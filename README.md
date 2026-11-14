# Shopify Multi-Tenant Ingest & Analytics

> High-throughput webhook ingestion, isolated multi-store partitioning, and real-time merchant retention analytics for multi-brand Shopify networks.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)](https://expressjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://www.mysql.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red?logo=redis)](https://bullmq.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

A decoupled e-commerce data pipeline built with Express 5, MySQL 8.0, and Next.js 16. It captures high-frequency order webhooks with raw TCP stream verification, guarantees zero duplicate records via a dual-engine queue, and computes real-time customer retention cohorts without blocking the Node.js event loop.

```text
⚡ 11.78ms P50 Ingress  ·  🛡️ 100% Duplicate Filter  ·  📊 <13ms Push-Down SQL  ·  🔄 Zero-Downtime Fallback
```

---

<!-- ════════════════════════════════════════════════════════════════════════════
     HERO ZONE — Recruiter completes here (First 1–2 scrolls, <75 lines)
     ════════════════════════════════════════════════════════════════════════════ -->

## 🌟 1. Key Features & Visual Walkthrough

<p align="center">
  <img src="screenshots/01-operations-dashboard.png" width="85%" alt="Shopify Real-Time Operations Dashboard" /><br/>
  <em>Shopify real-time operations dashboard featuring live order telemetry, worker status, and multi-tenant financial KPI metrics</em>
</p>

<details>
<summary>📸 <strong>Click to view additional interface workflows (RFM Customer Intelligence & 6-Month Cohort Retention)</strong></summary>
<br>

<p align="center">
  <img src="screenshots/02-rfm-customer-retention.png" width="85%" alt="RFM Customer Intelligence Matrix" />
  <br>
  <em>7-tier algorithmic RFM customer scoring and churn risk breakdown</em>
</p>

<p align="center">
  <img src="screenshots/03-sales-performance-trends.png" width="85%" alt="Sales Performance Trends & Cohort Retention" />
  <br>
  <em>Time-series revenue velocity curves and triangular monthly cohort retention matrix</em>
</p>

</details>


* ⚡ **Sub-12ms Ingress Webhook Architecture:** Captures raw TCP streams, validates HMAC SHA-256 signatures, checks sliding FIFO deduplication caches, and returns HTTP 200 in 11.78ms (p50).
* 🛡️ **Dual-Engine Queue Resilience:** Distributed worker dispatch via BullMQ + Redis, with automatic zero-downtime fallback to an in-memory `setImmediate()` microtask queue if Redis drops.
* 🔒 **Strict Multi-Tenant Isolation:** Complete tenant isolation enforced at gateway (`x-api-key`) and database layers via composite unique constraints (`@@unique([tenantId, externalId])`).
* 📊 **Algorithmic Merchant Intelligence:** 7-tier RFM customer scoring and 6-month monthly cohort retention matrices computed in 5–13ms via indexed raw SQL (`Prisma.sql`).

---

## ⚡ 2. Benchmarked Performance

Empirical metrics measured against local Express 5 + MySQL 8.0 infrastructure using the automated benchmark harness (`scripts/benchmark.ts`):

| Metric | Measured Value | Operational Guarantee / Significance |
| :--- | :--- | :--- |
| **Webhook Ingress Latency (P50)** | **`11.78 ms`** | Immediate HTTP 200 acknowledgment; well within Shopify's 5s SLA |
| **Webhook Ingress Tail Latency (P95)** | **`27.41 ms`** | Sub-30ms performance envelope under sustained burst load |
| **Webhook Ingress Tail Latency (P99)** | **`164.71 ms`** | Upper-bound response turnaround during queue bursts |
| **Top Customers SQL Aggregation (P50)** | **`5.27 ms`** | `LEFT JOIN` and `SUM` across indexed foreign keys |
| **Time-Series Sales Aggregation (P50)** | **`5.82 ms`** | In-engine aggregation via indexed `DATE(createdAt)` |
| **Monthly Cohort Retention (P50)** | **`10.96 ms`** | 6-month triangular retention matrix computation |
| **RFM Customer Segmentation (P50)** | **`12.99 ms`** | Algorithmic 7-tier scoring across full merchant catalog |
| **Duplicate Webhook Suppression** | **`100% Filtered ✅`** | Zero duplicate orders or double-counted revenue |
| **HMAC SHA-256 Cryptographic Check** | **`100% Validated ✅`** | Bit-for-bit raw buffer signature verification |

---

<!-- ════════════════════════════════════════════════════════════════════════════
     DEEP-DIVE ZONE — Hiring managers & staff engineers continue here
     ════════════════════════════════════════════════════════════════════════════ -->

## 🏗️ 3. System Architecture & Request Lifecycle

```text
Shopify Store (Tenant A / B)
   │
   ├── OAuth 2.0 Install Flow ─────────► Tenant Token Provisioning & Webhook Setup
   └── Webhooks (orders, customers) ───► POST /shopify/webhook
                                              │
                                       [Raw TCP Byte Stream Capture]
                                              │
                                       [HMAC SHA-256 Signature Verification]
                                              │
                                       [Sliding Deduplication Cache (Idempotency)]
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
             BullMQ Distributed Worker                   Resilient In-Memory
             (Redis Concurrency: 5)                     Tenant Microtask Queue
                         │                                         │
                         └────────────────────┬────────────────────┘
                                              ▼
                                   Prisma ORM (MySQL 8.0)
                                 [Strict Tenant Isolation]
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                    `Customer`             `Order`             `Product`
                   (totalSpent)       (tenantId_extId)      (price, sku)
                                              │
                                              ▼
                                 Insights & Analytics Engine
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
                 RFM Segmentation &                       Time-Series Sales &
              Monthly Cohort Matrices                       KPI Aggregates
                                              │
                                              ▼
                                   Next.js 16 Dashboard
                         (Live Telemetry • Trends • Customer Matrix)
```

1. **Ingress & Cryptographic Verification:** Express raw body stream listener captures the unparsed byte buffer (`req.rawBody`), verifies `X-Shopify-Hmac-Sha256` using constant-time verification, and checks the bounded in-memory sliding cache (`Set<string>`).
2. **Asynchronous Execution & Queueing:** Synchronous HTTP 200 acknowledgment returned in **11.78ms (p50)**; payload is dispatched to BullMQ on Redis (or scheduled on the Node.js event-loop Check phase via `setImmediate()` if Redis is offline).
3. **Data Normalization & Multi-Tenant Storage:** Queue worker resolves tenant context, upserts `Customer` records, creates/updates `Order` rows via `tenantId_externalId`, and atomically increments lifetime spend.
4. **Presentation & Real-Time Delivery:** Parameterized raw SQL aggregations (`Prisma.sql`) execute in 5–13ms, powering the Next.js 16 App Router dashboard with concurrent, non-blocking hydration.

---

## 🏛️ 4. Key Architectural Decisions

| ADR | Decision Title | Status | Context & Problem Trigger | Chosen Solution & Trade-offs |
| :--- | :--- | :---: | :--- | :--- |
| **ADR-01** | **Decoupled Express Backend vs. Monolithic Next.js** | **Accepted** | Next.js serverless body parsers re-serialize JSON, mutating bytes and breaking Shopify HMAC verification. Serverless cold starts and short execution limits risk dropping high-frequency webhooks. | Dedicated Express 5 backend capturing raw TCP bytes (`Buffer.concat`) before body parsing. Trade-off: Two deployable services instead of a single full-stack app. |
| **ADR-02** | **Dual-Engine Queue Architecture (BullMQ + Microtasks)** | **Accepted** | Hard dependencies on Redis cause unhandled 500 drops during local setup or Redis container restarts, prompting Shopify to disable store webhooks. | BullMQ + Redis as primary with automatic fallback to Node.js in-memory `setImmediate()` microtasks. Trade-off: In-memory queue is volatile on process crashes. |
| **ADR-03** | **Multi-Tenancy via Shared DB & Composite Unique Keys** | **Accepted** | Database-per-tenant introduces severe connection pool exhaustion, schema migration friction, and idle resource waste across thousands of smaller stores. | Shared MySQL database with tenant partitioning (`tenantId_extId`) on all tables, cascade deletes, and composite unique keys. Trade-off: Requires strict `WHERE tenantId` query discipline. |
| **ADR-04** | **Parameterized Raw SQL (`Prisma.$queryRaw`) for Analytics** | **Accepted** | Loading thousands of orders into Node.js heap memory to group by date or compute lifetime spend blocks the single-threaded event loop and risks OOM. | Push analytical math down to MySQL engine via parameterized SQL templates taking advantage of B-tree indexes. Trade-off: Manual typing replaces Prisma auto-generated types. |

---

## 🔬 5. Consistency & Failure Model

| Scenario / Failure Mode | System Behavior & Guarantee | Automatic Recovery Mechanism |
| :--- | :--- | :--- |
| **Primary Database Down** | Ingress accepts webhooks and buffers them safely in Redis; dashboard reads fail cleanly. | BullMQ retries jobs with exponential backoff (3 attempts); auto-resumes writes once MySQL reconnects. |
| **Redis Broker Offline** | Ingress automatically routes jobs to the in-memory `setImmediate()` microtask queue. | Zero-downtime local failover; automatically reconnects to Redis when the service is restored. |
| **Duplicate Webhook Delivery** | First tier sliding FIFO cache drops duplicates in <5ms; second tier MySQL `@@unique([tenantId, externalId])` serializes writes. | 100% idempotent upserts guarantee zero duplicate records or double-counted revenue. |
| **Malformed Payload ("Poison Pill")** | Worker catches unhandled parsing/schema errors; prevents worker crashes. | Retries 3 times with exponential backoff; evicts failed job to Dead Letter Queue (DLQ) and alerts operators. |

---

## 🚀 6. Tech Stack

| Layer / Concern | Technology | Version | Purpose & Architectural Rationale |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js | v20+ | High-throughput asynchronous event loop for I/O-bound webhook processing |
| **Language** | TypeScript | v5.x | Strict compile-time safety across payloads, DB schemas, and API contracts |
| **Backend REST API** | Express.js | v5.2.1 | Native async route handlers and unopinionated raw TCP body stream capture |
| **Primary Database** | MySQL | 8.0 | ACID compliance, strong consistency, and B-tree indexing for financial data |
| **ORM & Migrations** | Prisma ORM | v5.22.0 | Type-safe migrations and parameterized raw SQL (`Prisma.sql`) execution |
| **Distributed Queue** | BullMQ | v6.0.9 | Distributed background job queue with concurrency limits and retries |
| **Queue Broker** | Redis / IORedis | v6.0.0 | High-speed broker with automated fallback to microtasks when offline |
| **Frontend Framework**| Next.js (App Router)| v16.0.7 | Modern client architecture, layout optimization, and telemetry hydration |
| **Frontend UI & Visuals**| React / Recharts | v19 / v3.5 | Declarative SVG time-series visualizers and customer segment distributions |
| **Styling & Design** | Tailwind CSS | v4.x | Utility-first CSS design system supporting dense merchant data views |
| **Testing Framework** | Node Native Test Runner| v20+ | Fast, hermetic unit, security, and benchmark regression suites |

---

## ⚙️ 7. Quick Start

```bash
# 1. Clone & enter repository
git clone https://github.com/your-username/shopify-ingest.git
cd shopify-ingest

# 2. Configure environment credentials
cp .env.example .env

# 3. Install backend dependencies & start API server (http://localhost:4000)
npm install
npm run dev

# 4. In a separate terminal: install frontend dependencies & launch dashboard (http://localhost:3000)
cd frontend
npm install
npm run dev
```

* Frontend accessible at: `http://localhost:3000` | Backend API: `http://localhost:4000`

<details>
<summary>📋 <strong>Full installation runbook, environment variables, API reference & test commands</strong></summary>

### Prerequisites
* **Runtime:** Node.js v20.x or later
* **Database:** MySQL 8.0 running locally on port 3306
* **Cache / Queue:** Redis Server (*Optional* — system automatically falls back to in-memory queue if offline)

### Environment Variables (`.env`)

| Variable | Description | Example / Default Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | MySQL connection string for Prisma | `mysql://root:password@127.0.0.1:3306/shopify-ingest` |
| `PORT` | Express backend listening port | `4000` |
| `INTERNAL_API` | Internal communication URL | `http://localhost:4000` |
| `JWT_SECRET` | Authentication token signing secret | `your-secure-jwt-secret` |
| `SHOPIFY_API_KEY` | Shopify Partner App Client ID | `your-shopify-app-key` |
| `SHOPIFY_API_SECRET`| Shopify Partner App Shared Secret (HMAC) | `your-shopify-app-secret` |
| `SHOPIFY_SCOPES` | Permissions requested during OAuth | `read_customers,read_orders,read_products` |
| `HOST` | Tunnel URL for live webhook testing | `https://your-tunnel.ngrok-free.dev` |
| `REDIS_URL` | Redis server connection string (*optional*) | `redis://127.0.0.1:6379` |

### Database Initialization & Migrations
```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### Testing & Verification
```bash
npm test                    # Run cryptographic security & tenant isolation tests
npm run benchmark           # Run automated latency, throughput & idempotency suite
npx ts-node scripts/send_shopify_webhook.ts # Dispatch signed synthetic webhook test
```

### API Reference

All `/api/*` endpoints (except `/shopify/*`) require tenant authentication via the `x-api-key` header.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/shopify/webhook` | HMAC Header | Receives raw Shopify webhooks with cryptographic HMAC SHA-256 verification |
| `POST` | `/shopify/simulate-webhook` | None | Developer simulation endpoint for testing ingress without live Shopify store |
| `GET` | `/api/insights/summary` | `x-api-key` | Total customers, products, revenue, AOV, and repeat purchase rate |
| `GET` | `/api/insights/orders` | `x-api-key` | Time-series sales velocity and volume grouped by date (`start`, `end`) |
| `GET` | `/api/insights/rfm` | `x-api-key` | 7-segment RFM customer score and distribution breakdown |
| `GET` | `/api/insights/cohorts` | `x-api-key` | 6-month monthly customer cohort retention heatmap matrix |
| `GET` | `/api/insights/top-customers` | `x-api-key` | Ranked high-value customers by total historical spend (`limit`) |
| `GET` | `/api/insights/queue-status` | `x-api-key` | Real-time queue latency, job counters, and worker telemetry |

</details>

---

## 💡 8. Engineering Takeaways

- **Architectural Trade-offs (Decoupling vs Serverless):** Decoupling the ingestion gateway from the dashboard taught me that webhooks require raw stream preservation and connection pooling that serverless platforms actively complicate. Handling ingress in Express preserved cryptographic integrity and eliminated cold-start drop risks.
- **Simplicity vs Over-Engineering (Dual-Engine Fallback):** Designing the dual-engine fallback showed that resilience isn't always about adding complex multi-region clusters. Providing an in-memory microtask fallback dramatically simplified developer onboarding and local testing without compromising production Redis capabilities.
- **Measurement Over Guessing (Database Push-Down):** Profiling analytics endpoints with an automated benchmark harness exposed that computing cohort retention and RFM scores in JavaScript created significant latency; pushing math down to MySQL B-tree indexes via raw SQL dropped response times from >100ms to **5–13ms**.

---

## 🗺️ 9. Roadmap

- **Automated CSV & Excel Export:** Allow store owners to export RFM customer segments and monthly cohort retention tables for marketing campaign analysis.
- **Email Marketing Webhook Sync:** Automatically sync "At Risk" or "Champion" customer segments to email tools (e.g., Klaviyo or Mailchimp) to trigger automated win-back discount campaigns.
- **Custom Holiday & Seasonal Date Filters:** Enable merchants to compare retention cohorts and revenue velocity across custom peak shopping windows (e.g., Black Friday / Cyber Monday).

---

## 📄 10. License

Distributed under the [MIT License](LICENSE).
