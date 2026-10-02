# Transactional Outbox Pattern Evaluation & Architecture

## 1. Executive Summary

In a multi-tenant quick-commerce marketplace monolith, state transitions on mission-critical business entities—primarily Orders, Financial Payouts, Inventory Reservations, and Seller Lifecycle Changes—must remain strictly consistent with external systems, background tasks, customer notifications, and partner webhooks.

Directly dispatching asynchronous background tasks or publishing messages to an external message broker (such as Redis or RabbitMQ) from within application services introduces the classic **distributed dual-write problem**. This evaluation documents why the **Transactional Outbox Pattern** was evaluated, justified, and implemented for critical domain events in Quick Commerce.

---

## 2. The Dual-Write Problem in Monoliths

When a service modifies the database and communicates with an external system or queue, two distinct failure modes emerge:

### Failure Mode A: Enqueuing Before Commit

```
Application Service:
1. BEGIN TRANSACTION
2. Update SellerOrder status to SHIPPED
3. Enqueue Celery Task (send_shipping_notification)  <-- DISPATCHED
4. Database constraint violation or crash occurs     <-- ROLLBACK
```

_Consequence_: The background worker or external consumer processes the task, notifies the customer, or books external carrier APIs for an order that was rolled back and never existed in the database (phantom event).

### Failure Mode B: Enqueuing After Commit (or via `transaction.on_commit`)

```
Application Service:
1. BEGIN TRANSACTION
2. Update SellerOrder status to SHIPPED
3. COMMIT TRANSACTION                               <-- SUCCESS
4. Enqueue Celery Task (send_shipping_notification)  <-- NETWORK PARTITION / PROCESS CRASH
```

_Consequence_: While `transaction.on_commit` prevents phantom events, if the Redis broker is temporarily unreachable, the Celery connection pool times out, or the worker process crashes immediately after commit, the message is permanently lost with zero recovery trail.

---

## 3. The Transactional Outbox Solution

The Transactional Outbox pattern eliminates the dual-write problem by leveraging PostgreSQL's ACID guarantees:

1. **Atomic Insertion**: When a business state transition occurs (`Order`, `Payout`), an `OutboxEvent` row is inserted into PostgreSQL **within the exact same database transaction**.
2. **Guaranteed Commit**: If the business transaction commits, the outbox record commits. If the transaction rolls back, the outbox record rolls back. Event loss is mathematically impossible.
3. **Decoupled Asynchronous Processing**:
   - An immediate notification task is triggered via `transaction.on_commit(trigger_outbox_processing.delay)`.
   - A background Celery worker locks and fetches pending outbox events using PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED`.
   - The worker dispatches the event (e.g. delivers webhooks, sends notifications, triggers external partner APIs).
   - Upon successful dispatch, the event status is updated to `PROCESSED`.
   - If an error occurs, the event increments its `retry_count` with exponential backoff and jitter, eventually entering `FAILED` after reaching `max_retries`.
4. **Resilience & Reconciliation**: A periodic reconciliation task runs every minute to detect and process any events that were skipped or left pending due to temporary broker outages or worker crashes.

---

## 4. Architectural Implementation

### 4.1 Database Schema (`events_outbox`)

| Column         | Type           | Description                                                   |
| :------------- | :------------- | :------------------------------------------------------------ |
| `id`           | `UUID`         | Authoritative unique identifier                               |
| `topic`        | `VARCHAR(100)` | Domain routing key (e.g. `orders.seller_order.confirmed`)     |
| `event_key`    | `VARCHAR(255)` | Entity identifier for consumer deduplication and ordering     |
| `payload`      | `JSONB`        | Structured snapshot of event data                             |
| `status`       | `VARCHAR(20)`  | State machine: `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED` |
| `retry_count`  | `INTEGER`      | Current delivery retry counter                                |
| `max_retries`  | `INTEGER`      | Maximum retry threshold (default: 5)                          |
| `last_error`   | `TEXT`         | Truncated error message from most recent failed attempt       |
| `created_at`   | `TIMESTAMPTZ`  | Timestamp when the event was committed                        |
| `processed_at` | `TIMESTAMPTZ`  | Timestamp when delivery was confirmed                         |

### 4.2 Database Triggers for Immutability

To guarantee auditability and prevent tampering:

- `protect_events_outbox_mutation`: A PostgreSQL trigger that rejects modifications to `id`, `topic`, `event_key`, `payload`, and `created_at`. Only `status`, `retry_count`, `last_error`, and `processed_at` may be updated.
- `protect_events_outbox_deletion`: A PostgreSQL trigger that rejects all `DELETE` operations.

### 4.3 Celery Worker Concurrency & Locking

- **Non-blocking parallel processing**: Outbox consumers utilize `SELECT id FROM events_outbox WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED LIMIT 50`. This allows multiple Celery worker processes to consume batches concurrently without deadlocks or row contention.
- **Timeouts**: Every Celery task specifies explicit `time_limit` (hard limit: 120s) and `soft_time_limit` (90s) to prevent zombie processes.
- **Exponential Backoff with Jitter**: Avoids retry storms on external webhook sinks by adding randomized jitter:
  $$\text{delay} = 2^{\text{retry}} \times 5 + \text{uniform}(0.5, 2.0)$$

---

## 5. Justified Scope

The transactional outbox is activated for high-consequence business events:

- `orders.order.created`: Multi-seller customer checkout committed.
- `orders.seller_order.confirmed`: Seller accepted fulfillment responsibility.
- `orders.seller_order.shipped`: Goods dispatched with carrier tracking.
- `finance.payout.processed`: Funds disbursed from seller balance.
- `fulfillment.refund.processed`: Customer refund committed with commission reversal.

Low-risk transient operations (such as in-app read notifications or analytics logging) remain non-transactional to avoid unnecessary database write amplification.
