# Shopify Multi-Tenant Data Ingestion & Analytics Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)](https://expressjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://www.mysql.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red?logo=redis)](https://bullmq.io/)
[![License](https://img.shields.io/badge/License-MIT-purple)](#)

A high-performance, **multi-tenant e-commerce data ingestion and analytics platform** built for Shopify store networks. Designed to ingest, deduplicate, and process high-frequency webhook streams with **sub-12ms p50 latency**, enforce strict tenant-level data isolation, and deliver advanced merchant business intelligence (RFM customer segmentation, monthly cohort retention matrices, and time-series revenue velocity).

---

## Architecture Overview

```
Shopify Store (Tenant A / B)
   │
   ├── OAuth 2.0 Install Flow ─────────► Tenant Token Provisioning & Webhook Registration
   └── Webhooks (orders, customers) ───► POST /shopify/webhook
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

## Key Features & Engineering Highlights

### 1. High-Throughput Decoupled Webhook Ingestion
* **Sub-12ms p50 Ingress Latency:** HTTP webhook handlers acknowledge Shopify within milliseconds by offloading execution to asynchronous workers.
* **Cryptographic Security:** Every inbound webhook payload is validated against `x-shopify-hmac-sha256` using HMAC SHA-256 before ingestion.
* **Dual-Engine Queue Architecture:** Automatic distributed queue processing via **BullMQ + Redis**, with seamless zero-downtime fallback to an in-memory **Resilient Tenant Async Microtask Engine** if Redis is unavailable.

### 2. Strict Multi-Tenancy & Data Isolation
* **Schema-Level Partitioning:** Every record is bound to a dedicated `tenantId` foreign key with cascade deletion safety.
* **Zero Cross-Tenant Leakage:** Enforced at both the middleware layer (`x-api-key` validation) and query layer via composite unique constraints (`@@unique([tenantId, externalId])`).
* **100% Idempotency:** Duplicate webhook events are discarded through a bounded sliding cache and transactional database upserts.

### 3. Advanced Merchant Analytics & Intelligence
* **RFM Customer Segmentation:** Algorithmic Recency, Frequency, and Monetary (RFM) customer scoring (1–5 scale) classifying customers into 7 actionable tiers: *Champions, Loyalists, Potential Loyalists, At Risk, Need Attention, Hibernating, and Prospects*.
* **Monthly Cohort Retention Heatmap:** Computes customer retention decay curves across 6+ month offsets to track customer lifetime value (CLV) and churn.
* **Time-Series Sales Velocity:** Daily and monthly revenue aggregations with date-range filters and Average Order Value (AOV) tracking.
* **Product Catalog Insights:** Pricing distribution (min/max/average) and inventory tier tracking.

### 4. Real-Time Telemetry & Next.js 16 Dashboard
* **Live Worker Health Feeds:** Monitors active jobs, completed jobs, failed jobs, average queue latency, and per-tenant throughput in real time.
* **Built-in Webhook Burst Simulator:** Dispatch single or burst webhook payloads directly from the UI or developer API to test live pipeline ingestion under load.
* **Responsive Modern UI:** Built with Next.js 16 (App Router), SVG time-series visualizers, and tenant switching.

---

## Empirical Benchmark & Performance Results

Performance metrics verified using the automated benchmark suite ([scripts/benchmark.ts](./scripts/benchmark.ts)) against local Express + MySQL infrastructure:

### Webhook Ingress (HMAC Verification + Async Queuing)
| Metric | Measured Value | Description |
| :--- | :--- | :--- |
| **p50 Latency (Median)** | **`11.78 ms`** | Sub-12ms response turnaround |
| **p95 Latency** | **`27.41 ms`** | 95th percentile under load |
| **Minimum Latency** | **`7.58 ms`** | Fastest recorded acknowledgment |
| **Throughput (Single-Client)** | **`62.2+ req/sec`** | Sequential client ingestion rate |
| **Idempotency Deduplication** | **`100% Filtered ✅`** | Zero duplicate orders on re-delivery |

### Analytics & SQL Aggregation Query Latencies
| Endpoint | Description | Avg Latency | p50 (Median) | p95 Latency |
| :--- | :--- | :--- | :--- | :--- |
| `/api/insights/orders` | Time-Series Sales & AOV | **`6.11 ms`** | **`5.82 ms`** | **`7.48 ms`** |
| `/api/insights/top-customers` | Top Spending Customers | **`5.32 ms`** | **`5.27 ms`** | **`6.93 ms`** |
| `/api/insights/cohorts` | Monthly Cohort Retention Matrix | **`10.62 ms`** | **`10.96 ms`** | **`14.11 ms`** |
| `/api/insights/summary` | Overall Merchant KPIs | **`12.13 ms`** | **`11.00 ms`** | **`21.01 ms`** |
| `/api/insights/rfm` | RFM 7-Segment Scoring | **`13.47 ms`** | **`12.99 ms`** | **`20.81 ms`** |

*Full benchmark logs available in [docs/BENCHMARK_RESULTS.md](./docs/BENCHMARK_RESULTS.md).*

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Runtime** | Node.js (v20+), TypeScript (v5.x), Express.js (v5.x) |
| **Database & ORM** | MySQL 8.0, Prisma ORM (v5.x) |
| **Queue & Worker Engine** | BullMQ (v6.x), Redis (IORedis), Resilient In-Memory Microtask Queue |
| **Frontend Dashboard** | Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS |
| **Authentication & Security** | Shopify OAuth 2.0, HMAC SHA-256, API Key Middleware, Helmet.js |
| **Date & Math Utilities** | date-fns (v4.x), crypto |

---

## Getting Started

### Prerequisites
* **Node.js** (v18.x or v20.x recommended)
* **MySQL Server** (running on port 3306)
* **Redis Server** (optional, fallback queue activates automatically if offline)

### 1. Repository Setup & Environment
Clone the repository and install root backend dependencies:

```bash
git clone https://github.com/your-username/shopify-ingest.git
cd shopify-ingest
npm install
```

Create a `.env` file in the root directory:

```env
DATABASE_URL="mysql://root:your_password@127.0.0.1:3306/shopify-ingest"
PORT=4000
INTERNAL_API="http://localhost:4000"
JWT_SECRET="your-jwt-secret"

# Shopify Partner App Credentials (optional for dev simulation)
SHOPIFY_API_KEY="your-shopify-api-key"
SHOPIFY_API_SECRET="your-shopify-api-secret"
SHOPIFY_SCOPES="read_customers,read_orders,write_orders,read_products,read_checkouts"
HOST="https://your-ngrok-subdomain.ngrok-free.dev"

# Redis Queue Connection (optional)
REDIS_URL="redis://127.0.0.1:6379"
```

### 2. Database Migration & Seeding
Initialize the MySQL database schema and populate seed data:

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### 3. Start Backend Server
```bash
ngrok http 4000
npm run dev
```
Backend API will be running at `http://localhost:4000`.

### 4. Start Next.js Frontend Dashboard
In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```
Frontend will be accessible at `http://localhost:3000`.

---

## Running Automated Benchmarks

To execute the built-in latency, throughput, and idempotency benchmark suite:

```bash
npm run benchmark
```
This tests the running server under real load and updates `docs/BENCHMARK_RESULTS.md` with freshly measured percentiles (p50, p95, p99).

---

## API Reference

All `/api/*` endpoints (except `/health` and `/shopify/*`) require tenant authentication via the `x-api-key` header.

### Ingestion & Webhook Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/shopify/webhook` | Receives raw Shopify webhooks with HMAC SHA-256 verification |
| `POST` | `/shopify/simulate-webhook` | Developer endpoint to simulate webhook payloads |
| `POST` | `/api/data/customers` | Direct internal ingestion for Customer entities |
| `POST` | `/api/data/products` | Direct internal ingestion for Product entities |
| `POST` | `/api/data/orders` | Direct internal ingestion for Order entities |

### Insights & Analytics Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/insights/summary` | Total customers, products, revenue, AOV, and repeat rate |
| `GET` | `/api/insights/orders?start=YYYY-MM-DD&end=YYYY-MM-DD` | Time-series order volume and revenue grouped by date |
| `GET` | `/api/insights/rfm` | Full RFM scoring and customer segmentation breakdown |
| `GET` | `/api/insights/cohorts` | 6-month monthly cohort customer retention matrix |
| `GET` | `/api/insights/top-customers?limit=10` | Ranked list of highest spend customers |
| `GET` | `/api/insights/top-products?limit=10` | Product catalog pricing distribution and stats |
| `GET` | `/api/insights/queue-status` | Real-time queue latency, job counters, and worker telemetry |

---

## Project Structure

```
shopify-ingest/
├── docs/                        # Architectural documentation & benchmark reports
│   ├── ARCHITECTURE.md          # Multi-tenant ingestion & analytics architecture
│   └── BENCHMARK_RESULTS.md     # Auto-generated empirical performance report
├── frontend/                    # Next.js 16 App Router Frontend
│   ├── src/app/
│   │   ├── dashboard/           # Analytics dashboard (KPIs, Charts, RFM, Cohorts, Telemetry)
│   │   ├── login/               # Tenant authentication screen
│   │   ├── layout.tsx           # Root layout & font setup
│   │   └── page.tsx             # Landing & redirection page
│   └── package.json
├── prisma/
│   ├── schema.prisma            # Multi-tenant schema (Tenant, Customer, Product, Order)
│   └── seed.ts                  # Database seed script for development
├── scripts/
│   ├── benchmark.ts             # Automated latency & throughput benchmark suite
│   ├── seed-tenant.ts           # Realistic tenant customer/order generator
│   └── send_shopify_webhook.ts  # HMAC-signed webhook sender simulator
├── src/
│   ├── app.ts                   # Express application setup & middleware configuration
│   ├── index.ts                 # Server entry point
│   ├── startup.ts               # Startup sync & webhook re-registration handler
│   ├── middleware/
│   │   └── tenant.ts            # x-api-key tenant authentication middleware
│   ├── queue/
│   │   └── ingestQueue.ts       # BullMQ + Resilient async queue & telemetry engine
│   └── routes/
│       ├── data.ts              # Direct internal data ingestion routes
│       ├── insights.ts          # RFM, cohort matrix, time-series & KPI analytics
│       ├── shopify.ts           # OAuth 2.0 lifecycle & HMAC webhook receiver
│       └── tenants.ts           # Tenant registration & management
├── tests/
│   └── security.test.ts         # Automated HMAC SHA-256 & tenant security unit tests
├── .env.example                 # Environment variable template
├── package.json
└── tsconfig.json
```

---

## License
MIT License. Created for production-grade Shopify integration and analytics.
