# Background Jobs Plan for Scraping and Vectorization

## Recommendation

Use **pg-boss first**, then consider RabbitMQ later only if scale and routing complexity demand it.

## Decision Points (Important)

- `pg-boss` is not only for personal projects. It is production-capable when PostgreSQL is already part of your system.
- `pgAdmin` is not required for `pg-boss`. pgAdmin is only a database GUI tool.
- If your platform does not already run PostgreSQL reliably, RabbitMQ is usually the better choice.
- Do not add PostgreSQL only for queueing unless you need PostgreSQL for other core data workloads.
- Choose RabbitMQ when you want broker-first architecture, stronger routing patterns, and cleaner worker decoupling.
- Choose `pg-boss` when you already depend on PostgreSQL and want to move quickly with less infrastructure.

Why this is a strong approach:

- Reuses existing Postgres infrastructure.
- Faster to implement and easier to operate.
- Supports retries, scheduling, concurrency control, and dead-letter handling.
- Most early bottlenecks are scraping latency and embedding API limits, not queue technology.

## Rollout Plan

### 1) Define Job Boundaries

Create distinct jobs:

- `scrape_url`
- `chunk_and_embed`
- `upsert_vector_index`
- Optional: `cleanup_or_reindex`

Rules:

- Pass IDs/references in payloads.
- Avoid sending large raw HTML in queue messages.

### 2) Define Queue Contracts

For every job payload:

- Include `job_version` (start with `1`).
- Include idempotency key (example: `url_hash + document_version`).
- Include metadata like `trace_id` and `tenant_id`.

This allows safe evolution, observability, and multi-tenant control.

### 3) Implement Producer + Worker Pipeline

Flow:

1. API receives ingestion request.
2. API enqueues `scrape_url` and returns `202 Accepted` + `job_id`.
3. Worker executes chain:
   - `scrape_url` -> `chunk_and_embed` -> `upsert_vector_index`

Failure handling:

- Transient failures: retry with exponential backoff.
- Terminal failures: move to failed queue and persist error details.

### 4) Reliability Safeguards

Add the following controls:

- Dead-letter queue for poison jobs.
- Max attempt count per job type.
- Timeouts per step (scrape timeout, embed timeout, upsert timeout).
- Dedup guard to avoid processing same source/version multiple times.

Delivery model:

- Build for **at-least-once delivery**.
- Ensure handlers are idempotent.

### 5) Concurrency and Throughput Strategy

Use separate worker pools:

- Scraping workers (I/O-heavy)
- Embedding workers (rate-limit/API-heavy)
- Vector upsert workers (database/index-heavy)

Each queue gets independent concurrency settings.
Also add rate limiting for embedding provider quotas.

### 6) Data Model Additions

Add/extend tables:

- `ingestion_jobs`: status, attempts, started_at, finished_at, error_code, error_message
- `documents`: source_url, checksum, last_scraped_at, version
- `chunks`: chunk_id, document_id, text_hash
- `vector_sync_state`: last_embedded_version, index_status

### 7) Observability and Alerting

Track metrics:

- Queue depth
- Throughput
- Success/failure rate
- Retry count
- P95/P99 processing latency

Logging:

- Structured logs with `job_id` and `trace_id`.

Alerts:

- Queue backlog over threshold
- Repeated failure for same source
- Embedding provider error spike

### 8) API and UX Behavior

Client-facing flow:

- Ingestion endpoint returns quickly with `job_id`.
- Add status endpoint: `queued`, `running`, `success`, `failed`.
- UI polls status or subscribes via websocket/SSE for progress updates.

### 9) Security and Multi-Tenant Controls

Implement guardrails:

- URL validation and SSRF protection (block private/internal ranges).
- Per-tenant quotas and limits.
- Secrets stored only in worker environment variables (never queue payloads).

### 10) Phased Delivery

Phase 1:

- pg-boss setup
- one worker
- `scrape_url` only

Phase 2:

- Add `chunk_and_embed` and `upsert_vector_index`
- Wire full chain

Phase 3:

- Add retries, dead-letter queue, dashboards, alerts

Phase 4:

- Load test and tune concurrency/rate limits

Phase 5:

- Evaluate if RabbitMQ migration is needed

## RabbitMQ Migration Triggers

Revisit queue choice if one or more are true:

- Sustained queue lag despite tuned workers
- Need advanced routing patterns (topic/fanout-heavy)
- Many cross-language services consuming high-volume events
- Postgres becomes a bottleneck due to queue traffic

## Initial Defaults (Suggested)

- Retry attempts: 5
- Backoff: exponential (`30s`, `2m`, `10m`, `30m`, `2h`)
- Scrape timeout: 45s
- Embed timeout: 60s
- Upsert timeout: 30s
- Dead-letter after max attempts reached

These should be tuned after observing real production metrics.
