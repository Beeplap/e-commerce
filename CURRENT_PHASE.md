PHASE 21

Implement only Phase 21: Payment Integration & Idempotency as defined in `instructions2.md`.

Scope: Dedicated `apps/payments` app; Payment and PaymentTransaction models linked to master Order; payment statuses PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED; idempotency key middleware/guard rejecting duplicate submissions or returning existing transaction; payment confirmation service (on capture: transition Order and child SellerOrders to CONFIRMED/PROCESSING, convert inventory reservation to sale ledger transactions, credit SellerBalance with net payout amounts and commission debits, emit payment.captured outbox event; on failure: mark FAILED, release inventory reservations, cancel order); mock/Stripe payment gateway abstraction; signed webhook handler with HMAC signature validation; endpoints POST /api/v1/checkout/payment-intent/, POST /api/v1/checkout/confirm-payment/, and POST /api/v1/webhooks/payment/; Next.js payment form component and payment failure retry handling. Future phases remain architectural context until their turn.

After Phase 21 passes all required validation, update documentation and progress, advance this selector, commit, and push before beginning the next phase. Sequential continuation is authorized. Stop advancement on failed validation or push, and respect later user pause or scope instructions.
