# Empirical Performance & Benchmark Report

**Generated At:** `2026-08-07T17:20:03.050Z`  
**Target Environment:** `http://localhost:4000`  
**Tenant Tested:** `xeno-test-126 (Shopify)` (`benchmark-store.myshopify.com`)

---

## 1. Webhook Ingress Performance (HMAC SHA-256 + Async Ingestion)

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Total Requests Evaluated** | `100` | In-flight HTTP POST webhooks |
| **p50 Latency (Median)** | **`11.78 ms`** | Time to verify HMAC & enqueue |
| **p95 Latency** | **`27.41 ms`** | 95th percentile response time |
| **p99 Latency** | **`164.71 ms`** | 99th percentile response time |
| **Minimum Latency** | **`7.58 ms`** | Fastest recorded acknowledgment |
| **Throughput (Single-Client Sequential)** | **`62.2 req/sec`** | Worker capacity scales with concurrency |

---

## 2. Analytics & Complex SQL Aggregation Latencies

| Endpoint | Description | Avg Latency | p50 (Median) | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/insights/summary` | Summary Aggregation | **`12.13 ms`** | **`11 ms`** | **`21.01 ms`** | **`39.55 ms`** |
| `/api/insights/orders` | Time-Series Orders | **`6.11 ms`** | **`5.82 ms`** | **`7.48 ms`** | **`9.96 ms`** |
| `/api/insights/top-customers` | Top Customers | **`5.32 ms`** | **`5.27 ms`** | **`6.93 ms`** | **`7.46 ms`** |
| `/api/insights/rfm` | RFM Customer Segmentation | **`13.47 ms`** | **`12.99 ms`** | **`20.81 ms`** | **`22.93 ms`** |
| `/api/insights/cohorts` | Cohort Retention Matrix | **`10.62 ms`** | **`10.96 ms`** | **`14.11 ms`** | **`15.08 ms`** |

---

## 3. Data Integrity, Security & Idempotency

* **HMAC SHA-256 Signature Verification:** `100% Validated`
* **Duplicate Webhook Deduplication:** `100% Filtered & Verified ✅`
* **Tenant Isolation:** Enforced at query and database index levels.
