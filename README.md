# Shopify Multi-Tenant Data Ingestion & Analytics Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)](https://expressjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://www.mysql.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red?logo=redis)](https://bullmq.io/)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

A high-performance, **multi-tenant e-commerce data ingestion and analytics platform** built for Shopify store networks. Designed to ingest, deduplicate, and process high-frequency webhook streams with **sub-12ms p50 latency**, enforce strict tenant-level data isolation, and deliver advanced merchant business intelligence (RFM customer segmentation, monthly cohort retention matrices, and time-series revenue velocity).

---

## 🎯 1. Problem Statement & Core Value Proposition

### Why Naive Webhook Pipelines Fail
Building multi-store e-commerce ingestion pipelines with conventional monolithic or serverless architectures exposes critical vulnerabilities:
1. **Cryptographic HMAC Invalidation:** Modern web frameworks and body parsers automatically buffer and parse incoming JSON payloads into JavaScript objects. Re-stringifying JSON mutates whitespace, key ordering, and floating-point representations, causing Shopify HMAC-SHA256 signature checks to fail and rejecting valid payloads.
2. **Ingress Timeouts & Dropped Webhooks:** Shopify enforces strict 5-second webhook delivery deadlines. Executing synchronous database writes, customer recalculations, or complex business logic directly in HTTP request handlers leads to thread blocking and delivery timeouts during traffic spikes (e.g., flash sales or Black Friday), causing Shopify to disable webhook subscriptions.
3. **Cross-Tenant Data Leakage:** In multi-tenant platforms, storing store metrics without strict schema-level constraints risks catastrophic cross-tenant leakage where Store A accesses Store B's sensitive revenue and customer records.
4. **Analytical Query Exhaustion:** Computing real-time merchant retention cohorts and RFM scores in application memory blocks the Node.js single-threaded event loop and exhausts server memory.

### Core Value Proposition
This platform resolves these challenges by combining **raw TCP stream capture**, a **dual-engine decoupled queue** (BullMQ + Redis with in-memory microtask fallback), **strict schema-level tenant partitioning** (`tenantId_extId`), and **push-down parameterized SQL analytical engines**, delivering sub-12ms ingress latency and real-time merchant analytics.

---

## 🌟 2. Key Features & Visual Walkthrough

| 📊 Real-Time Operations Dashboard | 👥 RFM Customer Intelligence |
| :---: | :---: |
| <img src="screenshots/01-operations-dashboard.png" width="480" alt="Shopify Real-Time Operations Dashboard" /> | <img src="screenshots/02-rfm-customer-retention.png" width="480" alt="RFM Customer Intelligence Matrix" /> |
| *Live worker telemetry feeds, gross sales velocity, and AOV tracking* | *7-tier algorithmic RFM customer scoring and churn risk breakdown* |

<p align="center">
  <img src="screenshots/03-sales-performance-trends.png" width="720" alt="Sales Performance Trends & Cohort Retention" /><br/>
  <em>Time-series revenue velocity, volume curves, and 6-month monthly cohort retention heatmaps</em>
</p>

* **Sub-12ms Ingress Webhook Architecture:** Receives high-frequency Shopify webhooks, performs HMAC signature checks, checks deduplication caches, and returns HTTP 200 within milliseconds.
* **Dual-Engine Queue Resilience:** Automatic distributed background worker dispatch via BullMQ + Redis, with seamless zero-downtime fallback to an in-memory `setImmediate()` microtask queue if Redis is offline.
* **Strict Schema Multi-Tenancy:** Complete tenant isolation enforced at middleware (`x-api-key`) and database layers via composite unique constraints (`@@unique([tenantId, externalId])`).
* **Algorithmic RFM Segmentation:** 7-segment customer intelligence classification (*Champions, Loyalists, Potential Loyalists, At Risk, Need Attention, Hibernating, Prospects*) with targeted marketing guidance.
* **Cohort Retention Heatmaps:** 6-month customer cohort tracking calculating decay curves and repeat purchase behavior.

---

## 🏗️ 3. System Architecture & Request Lifecycle

```
Shopify Store (Tenant A / B)
   │
   ├── OAuth 2.0 Install Flow ─────────► Tenant Token Provisioning & Webhook Registration
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
                 (Redis Connection)                    Tenant Microtask Queue
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

---

## ⚡ 4. Key Highlights & Benchmarked Performance

Empirical metrics measured against local Express 5 + MySQL 8.0 infrastructure using the automated benchmark harness (`scripts/benchmark.ts`):

### Webhook Ingress (HMAC Verification + Async Enqueue)
| Metric | Measured Value | Operational Rationale |
| :--- | :--- | :--- |
| **p50 Latency (Median)** | **`11.78 ms`** | Immediate HTTP 200 acknowledgment to Shopify |
| **p95 Latency** | **`27.41 ms`** | Sustained sub-30ms performance under burst load |
| **p99 Latency** | **`164.71 ms`** | Upper-bound response turnaround during queue bursts |
| **Minimum Latency** | **`7.58 ms`** | Fastest recorded signature verification + dispatch |
| **Throughput (Single-Client)** | **`62.2 req/sec`** | Sequential client ingestion capacity |
| **Duplicate Webhook Filtering** | **`100% Filtered ✅`** | Zero duplicate orders written to database |
| **HMAC SHA-256 Verification** | **`100% Validated ✅`** | Bit-for-bit cryptographic verification on raw buffers |

### Analytics & Aggregation Query Latencies
| Endpoint | Description | p50 (Median) | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- |
| `/api/insights/orders` | Time-Series Sales & AOV | **`5.82 ms`** | **`7.48 ms`** | **`9.96 ms`** |
| `/api/insights/top-customers` | Top Spending Customers | **`5.27 ms`** | **`6.93 ms`** | **`7.46 ms`** |
| `/api/insights/cohorts` | Monthly Cohort Retention Matrix | **`10.96 ms`** | **`14.11 ms`** | **`15.08 ms`** |
| `/api/insights/summary` | Overall Merchant KPIs | **`11.00 ms`** | **`21.01 ms`** | **`39.55 ms`** |
| `/api/insights/rfm` | RFM 7-Segment Scoring | **`12.99 ms`** | **`20.81 ms`** | **`22.93 ms`** |

---

## 🚀 5. Tech Stack & Engineering Rationale

| Layer | Technology | Version | Engineering Rationale |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js | v20+ | High-throughput asynchronous event loop for I/O-intensive webhook processing |
| **Language** | TypeScript | v5.x | Compile-time typing across webhook payloads, database schemas, and API contracts |
| **Backend Framework**| Express.js | v5.2.1 | Lightweight, unopinionated raw socket body interception and REST routing |
| **Database** | MySQL | 8.0 | ACID compliance, strong consistency, and robust B-tree indexing for financial transactions |
| **ORM & Migrations** | Prisma ORM | v5.22.0 | Type-safe queries, migration management, and parameterized raw SQL execution |
| **Distributed Queue**| BullMQ | v6.0.9 | Distributed background job queuing with Redis broker, automatic retries, and rate limits |
| **In-Memory Broker** | Redis / IORedis | v6.0.0 | High-speed queue broker with automated microtask fallback when unavailable |
| **Frontend Framework**| Next.js (App Router)| v16.0.7 | Server-side rendering, layout optimization, and unified merchant visualization |
| **Frontend UI** | React | v19.2.0 | Modern reactive interface state management and telemetry polling |
| **Styling** | Tailwind CSS / PostCSS | v4.x | Utility-first CSS design system supporting data-heavy merchant tables and charts |
| **Visualizations** | Recharts | v3.5.1 | Declarative SVG time-series visualizers and customer segment distributions |
| **Security & Headers**| Helmet.js / CORS | v8.1 / v2.8 | Protection against XSS, clickjacking, and strict localhost CORS boundaries |
| **Date & Math** | date-fns | v4.1.0 | Pure functional timezone-aware date math for monthly cohort bucket calculations |
| **External API** | Shopify Admin REST API | 2024-07 | Official OAuth 2.0 flow, webhook subscription webhooks, and catalog syncing |

---

## 🏛️ 6. Key Architectural Decisions

| ADR ID | Decision Title | Status | Context & Problem | Chosen Solution & Trade-offs |
|:---|:---|:---:|:---|:---|
| **ADR-01** | Decoupled Express.js Ingestion vs. Monolithic Next.js | **Accepted** | Next.js serverless body parsers re-serialize JSON, mutating bytes and breaking Shopify HMAC verification. | Dedicated Express 5 backend capturing raw TCP bytes (`Buffer.concat`) before body parsing. Trade-off: Two deployable services instead of one. |
| **ADR-02** | Dual-Engine Queue Architecture (BullMQ + Microtask Fallback) | **Accepted** | Requiring Redis complicates local dev; Redis downtime would cause webhook drops and Shopify disabling. | BullMQ + Redis as primary with graceful automatic fallback to Node.js in-memory microtasks. Trade-off: In-memory queue is volatile on process crashes. |
| **ADR-03** | `setImmediate()` Check Phase vs. `process.nextTick()` | **Accepted** | In fallback mode, background processing must not starve the Node.js event loop or delay HTTP 200 responses. | `setImmediate()` executes in the event loop Check phase after I/O cycles complete. Trade-off: Jobs execute after the current event loop iteration. |
| **ADR-04** | Multi-Tenancy via Shared DB & Composite Unique Keys | **Accepted** | Multi-database architectures create connection pool exhaustion and high operational overhead. | Shared MySQL database with tenant partitioning (`tenantId_extId`) on all tables and cascade deletes. Trade-off: Requires strict `WHERE tenantId` query discipline. |
| **ADR-05** | Parameterized Raw SQL (`Prisma.$queryRaw`) Aggregations | **Accepted** | Loading thousands of orders into Node.js heap for in-memory JS aggregation causes latency and memory spikes. | Push analytical math down to MySQL engine via parameterized SQL templates. Trade-off: Manual typing replaces automatic Prisma schema types. |
| **ADR-06** | Two-Tier Webhook Idempotency (Sliding FIFO + DB Upserts) | **Accepted** | Shopify guarantees at-least-once delivery; duplicate events corrupt revenue and customer spend totals. | First tier in-memory FIFO Set cache (5,000 keys) rejects duplicates in sub-1ms; second tier DB upserts guarantee safety. Trade-off: In-memory cache is node-local. |
| **ADR-07** | Shopify 64-bit ID Storage as String vs. Native BigInt | **Accepted** | Shopify resource IDs exceed JavaScript's safe integer limit ($2^{53} - 1$), causing truncation in standard JS numbers. | Stored as `VARCHAR(64)` strings across database, runtime, and API serialization. Trade-off: Slightly larger index storage footprint. |
| **ADR-08** | Static Threshold Scoring for RFM Customer Segmentation | **Accepted** | Percentile quintiles fail on small customer bases and shift dynamically as new customers register. | Fixed business thresholds (e.g., Recency < 30 days = 5, Spend > $500 = 5) ensuring predictable, interpretable customer tiers. Trade-off: Requires threshold tuning per merchant. |

---

## 📁 7. Repository & Codebase Structure

```
shopify-ingest/
├── docs/                        # Architectural specifications & benchmark reports
│   ├── ARCHITECTURE.md          # Multi-tenant ingestion & analytics architecture
│   └── BENCHMARK_RESULTS.md     # Auto-generated empirical benchmark outputs
├── frontend/                    # Next.js 16 App Router Frontend
│   ├── src/app/
│   │   ├── dashboard/           # Merchant analytics dashboard (KPIs, RFM, Cohorts)
│   │   ├── login/               # Tenant API key authentication screen
│   │   ├── layout.tsx           # Root application layout & typography
│   │   └── page.tsx             # Entry redirect & auth router
│   └── package.json
├── prisma/
│   ├── schema.prisma            # Multi-tenant schema (Tenant, Customer, Product, Order)
│   └── seed.ts                  # Synthetic merchant data generator
├── screenshots/                 # Application visual documentation & screenshots
├── scripts/
│   ├── benchmark.ts             # Automated latency, throughput & idempotency suite
│   ├── seed-tenant.ts           # Realistic tenant customer and order simulator
│   └── send_shopify_webhook.ts  # HMAC-signed webhook sender simulator
├── src/
│   ├── app.ts                   # Express application setup & raw body middleware
│   ├── index.ts                 # Server entry point & startup hook
│   ├── startup.ts               # Startup sync & webhook re-registration handler
│   ├── middleware/
│   │   └── tenant.ts            # x-api-key tenant authentication middleware
│   ├── queue/
│   │   └── ingestQueue.ts       # Dual-engine BullMQ + in-memory microtask engine
│   └── routes/
│       ├── data.ts              # Direct internal data ingestion routes
│       ├── insights.ts          # RFM, cohort matrix, time-series & KPI analytics
│       ├── shopify.ts           # OAuth 2.0 lifecycle & HMAC webhook receiver
│       └── tenants.ts           # Tenant registration & API key management
├── tests/
│   └── security.test.ts         # HMAC SHA-256 validation & tenant isolation tests
├── .env.example                 # Environment configuration template
├── package.json
└── tsconfig.json
```

---

## ⚙️ 8. Installation & Developer Runbook

### Prerequisites
* **Node.js** (v20.x or later recommended)
* **MySQL Server** (8.0 running locally on port 3306)
* **Redis Server** (*Optional* — platform automatically falls back to in-memory queue if offline)

### 1. Repository Setup & Dependencies
```bash
git clone https://github.com/your-username/shopify-ingest.git
cd shopify-ingest
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:

| Variable | Description | Example / Default |
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

### 3. Database Initialization & Seeding
```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4. Launch Backend Services
```bash
npm run dev
```
*Backend API initializes at `http://localhost:4000`.*

### 5. Launch Frontend Merchant Dashboard
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend dashboard launches at `http://localhost:3000`.*

---

## 📡 9. API Reference

All `/api/*` endpoints (except `/health` and `/shopify/*`) require tenant authentication via the `x-api-key` header.

### Ingestion & Webhook Endpoints
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/shopify/webhook` | HMAC Header | Receives raw Shopify webhooks with cryptographic HMAC SHA-256 verification |
| `POST` | `/shopify/simulate-webhook` | None | Developer simulation endpoint for testing ingress without live Shopify store |
| `POST` | `/api/data/customers` | `x-api-key` | Direct ingestion for Customer entities |
| `POST` | `/api/data/products` | `x-api-key` | Direct ingestion for Product catalog entities |
| `POST` | `/api/data/orders` | `x-api-key` | Direct ingestion for Order transaction entities |

### Insights & Analytics Endpoints
| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/insights/summary` | `x-api-key` | Total customers, products, revenue, AOV, and repeat purchase rate |
| `GET` | `/api/insights/orders?start=YYYY-MM-DD&end=YYYY-MM-DD` | `x-api-key` | Time-series order volume and gross revenue grouped by date |
| `GET` | `/api/insights/rfm` | `x-api-key` | Full 7-segment RFM customer score and distribution breakdown |
| `GET` | `/api/insights/cohorts` | `x-api-key` | 6-month monthly customer cohort retention heatmap matrix |
| `GET` | `/api/insights/top-customers?limit=10` | `x-api-key` | Ranked high-value customers by total historical spend |
| `GET` | `/api/insights/top-products?limit=10` | `x-api-key` | Product catalog pricing distribution, volume, and stock tiers |
| `GET` | `/api/insights/queue-status` | `x-api-key` | Real-time queue latency, job counters, and worker telemetry |

---

## 🧪 10. Automated Testing & Verification

### Run Automated Security & Integration Suite
```bash
npm test
```
*Executes unit and integration tests verifying HMAC-SHA256 signature verification, rejection of tampered payloads, and tenant isolation constraints.*

### Run Empirical Latency & Ingress Benchmarks
```bash
npm run benchmark
```
*Dispatches concurrent webhook batches against the running server, evaluates p50/p95/p99 turnaround latencies, validates deduplication filtering, and updates `docs/BENCHMARK_RESULTS.md`.*

### Simulate Webhook Dispatch
```bash
npx ts-node scripts/send_shopify_webhook.ts
```
*Generates and transmits cryptographically signed synthetic webhook payloads to test live queue ingestion.*

---

## 🗺️ 11. Roadmap & Engineering Directions

- [ ] **Automated CSV & Excel Export:** Allow store owners to export RFM customer segments and monthly cohort retention tables for marketing and campaign analysis.
- [ ] **Email Marketing Webhook Sync:** Automatically sync "At Risk" or "Champion" customer segments to email tools (e.g., Klaviyo or Mailchimp) to trigger automated win-back discount campaigns.
- [ ] **Custom Holiday & Seasonal Date Filters:** Enable merchants to compare retention cohorts and revenue velocity across custom peak shopping windows (e.g., Black Friday / Cyber Monday).

---

## 📄 12. License

Distributed under the [MIT License](LICENSE).
