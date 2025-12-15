# Shopify Multi-Tenant Data Ingestion & Analytics Platform

This project implements a **multi-tenant backend platform** to ingest, store, and analyze Shopify store data (Customers, Orders, Products) and visualize key business metrics via a dashboard.

The system is designed to support **multiple Shopify stores (tenants)** with strict data isolation and real-time synchronization using webhooks.

---

## Architecture Overview

**High-level flow**

```
Shopify Store
   ├── OAuth Install → Tenant + Token
   ├── Webhooks (orders/create, etc.)
   │        ↓ (HMAC verified)
   └── Webhook Forwarder
            ↓
Internal Ingestion APIs
   ├── /api/data/customers
   ├── /api/data/products
   └── /api/data/orders
            ↓
MySQL (via Prisma ORM)
            ↓
Insights APIs
            ↓
Next.js Dashboard
```

---

## Key Features Implemented

### 1. Shopify Store & App Setup

* Shopify Partner app created
* Development store created (`xeno-test-126.myshopify.com`)
* Dummy products, customers, and orders added
* App installed on the development store

---

### 2. Multi-Tenant Data Ingestion Service

#### A. Internal API Ingestion

Endpoints:

* `POST /api/data/customers`
* `POST /api/data/products`
* `POST /api/data/orders`

Features:

* Tenant authentication using `x-api-key`
* Strict tenant isolation using `tenantId`
* Idempotent upserts using `(tenantId, externalId)`
* Referential integrity (Customer ↔ Orders)
* Prisma ORM with MySQL
* Proper error handling (401 on invalid API key)

This ingestion path is also used internally by webhook forwarding.

---

#### B. Shopify Webhook Ingestion

* Shopify OAuth install flow implemented
* Stores:

  * `shopDomain`
  * `accessToken`
  * `tenant` mapping
* Webhooks registered programmatically
* HMAC verification implemented
* Webhook events forwarded to internal ingestion APIs
* Retry logic implemented in forwarder
* Test script provided to simulate Shopify webhook payloads

**Note on Protected Topics**
Subscription to protected topics (`customers/*`, some `orders/*`) requires Shopify approval and is not available in dev stores.
This is expected and handled correctly using internal ingestion APIs for testing.

---

### 3. Multi-Tenancy & Isolation

* Dedicated `Tenant` table
* Unique `apiKey` per tenant
* All entities linked via `tenantId`
* No cross-tenant data access possible
* Tenants created via:

  * Manual API (`/api/tenants`)
  * Shopify OAuth install

---

### 4. Authentication & Security

* API-key–based tenant authentication
* Shopify HMAC verification
* OAuth token exchange
* Secure internal forwarding using tenant API keys

---

### 5. Sync Mechanism

* Event-driven sync using Shopify webhooks
* Webhook retry handling
* Manual webhook simulation script
* Centralized ingestion logic (single source of truth)

---

### 6. Analytics & Insights APIs

Implemented read-only analytics endpoints:

* `/api/insights/summary`

  * Total customers
  * Total orders
  * Total revenue
* `/api/insights/orders`

  * Orders grouped by date (supports date range filters)
* `/api/insights/top-customers`

  * Top customers by spend
* `/api/insights/recent-orders`

---

### 7. Frontend Dashboard (Next.js)

* Email-auth–backed UI (basic)
* Dashboard shows:

  * Summary cards (customers, orders, revenue)
  * Revenue trend chart
  * Orders by date (with date range filtering)
  * Top customers by spend
  * Recent orders table
* Axios requests authenticated using `x-api-key`

Frontend is intentionally minimal and focuses on correctness over styling.

---

## Tech Stack

**Backend**

* Node.js + TypeScript
* Express
* Prisma ORM
* MySQL
* Shopify Admin APIs & Webhooks

**Frontend**

* Next.js (App Router)
* Axios
* Charting library for trends

---

## Running the Project

### Backend

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Backend runs on:

```
http://localhost:4000
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```
http://localhost:3000
```

---

## Design Decisions

* **Webhook forwarding to internal APIs**
  Avoids duplication and ensures a single ingestion path.

* **Derived analytics fields (e.g., customer spend)**
  Stored for read efficiency, but source of truth remains Orders.

* **Event-driven sync**
  Webhooks preferred over polling for scalability and freshness.

* **Tenant-level isolation enforced at query level**
  Prevents data leakage by design.

---

## Known Limitations

* Protected Shopify topics cannot be subscribed to without approval
* Analytics queries are simple aggregates (no materialized views)
* No role-based access control (single-tenant admin assumption)
* Dashboard UI is functional but not production-polished

---

## Future Enhancements

* Automatic recomputation of derived metrics (e.g., customer lifetime value)
* Background jobs for reconciliation and backfills
* Pagination and caching for analytics endpoints
* Role-based access control
* Advanced analytics (cohorts, retention, product performance)
* Production-grade UI with better UX and charts
* Deployment with CI/CD and environment separation

---

## Summary

This project demonstrates:

* Strong backend fundamentals
* Correct multi-tenant architecture
* Real-world Shopify integration
* Secure ingestion and synchronization
* Clean separation of concerns
* Scalable design choices

The backend platform is production-aligned, and the frontend serves as a functional analytics layer on top of it.