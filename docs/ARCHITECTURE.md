# System Architecture & Multi-Tenant Design

## Overview
This platform functions as a centralized, high-throughput ingestion engine and analytics system for multi-tenant Shopify merchants.

```
┌─────────────────────────┐          ┌───────────────────────────────────────┐
│  Shopify Merchant Store │          │         Next.js 16 Dashboard          │
│   (Webhooks & OAuth)    │          │     (KPIs, Cohorts, RFM, Telemetry)   │
└────────────┬────────────┘          └───────────────────▲───────────────────┘
             │                                           │
             │ HTTPS POST                                │ REST (X-Tenant-Key)
             ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Express.js Ingestion Engine                         │
│  ├── Security: HMAC SHA-256 Signature Validation                           │
│  ├── Tenant Isolation Middleware (`tenantId` extraction & DB filter)       │
│  └── Telemetry: Queue Metrics & Health Engine                              │
└──────────────────────┬──────────────────────────────────▲──────────────────┘
                       │                                  │
                       │ Asynchronous Enqueue             │ Direct Read
                       ▼                                  │
         ┌───────────────────────────┐                    │
         │   BullMQ / Redis Queue    │                    │
         │  (Backpressure Buffer)    │                    │
         └─────────────┬─────────────┘                    │
                       │ Worker Processor                 │
                       ▼                                  │
         ┌───────────────────────────┐                    │
         │  Prisma ORM Data Pipeline │                    │
         │ (Idempotent DB Upserts)   │                    │
         └─────────────┬─────────────┘                    │
                       │                                  │
                       ▼                                  │
         ┌────────────────────────────────────────────────┴──────────────────┐
         │                       MySQL 8.0 Database                          │
         │  ├── `Tenant` (Domain, Encrypted Access Token, API Key)           │
         │  ├── `Customer` (Multi-tenant scoped, RFM aggregates)             │
         │  ├── `Order` (Multi-tenant scoped, timestamped line items)        │
         │  └── `Product` (Multi-tenant scoped inventory)                    │
         └───────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Principles

### 1. Cryptographic Security & Ingress Protection
* **HMAC SHA-256 Validation:** Every webhook received from Shopify is cryptographically verified against the tenant's client secret using the raw request body before parsing. Unsigned or invalid requests are rejected with `401 Unauthorized` before any processing occurs.
* **Idempotency & Deduplication:** Shopify webhooks may occasionally deliver duplicates. The ingestion pipeline tracks webhook IDs and enforces unique database constraints (`shopifyOrderId`, `tenantId`), ensuring safe at-least-once delivery handling.

### 2. High-Throughput Asynchronous Processing
* **Sub-12ms Response Time:** Webhook handlers immediately acknowledge incoming payloads after HMAC validation and offload processing to BullMQ backed by Redis.
* **Resilient In-Memory Fallback:** When Redis is unavailable during local development, an internal microtask queue handles tasks smoothly without crashing the server.

### 3. Multi-Tenant Isolation
* **Tenant API Keys:** Every registered merchant store receives a cryptographically random API key.
* **Scoped Queries:** All analytics endpoints (`/api/insights/*`) require the `X-Tenant-Key` header. Middleware resolves the `tenantId` and automatically scopes all database queries, preventing cross-tenant data leaks.

### 4. Advanced Analytical Insights
* **RFM Scoring:** Real-time customer categorization into 7 segments (*Champions*, *Loyal Customers*, *Potential Loyalists*, *At Risk*, *Lost*, etc.) based on Recency, Frequency, and Monetary metrics.
* **Cohort Retention Analysis:** Monthly cohort acquisition tracking measuring repeat order retention over rolling timeframes.
* **Telemetry Monitoring:** Live BullMQ queue health and webhook processing latency monitoring on the dashboard.
