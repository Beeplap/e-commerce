# EXECUTION RULE

This document contains the complete project roadmap and authorizes sequential implementation.

Start with the phase recorded in `CURRENT_PHASE.md`. Complete one phase at a time, in order, without skipping phases or implementing later-phase features early. Later phases provide architectural context while the current phase is active.

After completing each phase:
1. run every required test, formatting, lint, type, build, migration, and security check applicable to that phase;
2. fix failures caused by the work without weakening tests or disabling security controls;
3. update `docs/progress.md` with completed work, validation results, known issues, technical debt, security considerations, and the next phase;
4. record architectural decisions future phases must respect in `AGENTS.md` or the appropriate documentation;
5. summarize the completed phase and advance `CURRENT_PHASE.md` to the next numbered phase;
6. commit the completed phase and updated documentation in coherent commits, then push to the configured GitHub remote;
7. after the push succeeds, continue directly to the next phase without waiting for another instruction or confirmation.

If validation, a required dependency, authorization, or the GitHub push is blocked, record and report the actual blocker. Do not claim completion, skip checks, force-push, discard user changes, or begin the next phase until the gate is satisfied. Respect any later user instruction to pause or narrow the scope.

After Phase 16 is complete, validated, documented, committed, and pushed, mark the roadmap complete in `CURRENT_PHASE.md` and provide the final project report. Do not invent additional phases.

# MULTI-VENDOR E-COMMERCE ADMIN PLATFORM — CODEX BUILD SEQUENCE

## PHASE 0 — Repository constitution, architecture, and development environment

You are starting inside an EMPTY project directory.

We are building a production-grade multi-vendor e-commerce administration platform.

The application currently focuses on:

1. Seller Admin Panel
2. Super Admin / Platform Admin Panel
3. Secure Django API/backend supporting both
4. Architecture suitable for a future customer storefront

Do NOT build the entire application in this phase.

Your job in Phase 0 is to establish the repository, engineering standards, architecture, security invariants, development environment, and documentation that every later phase must follow.

### Core stack

Frontend:
- React
- Next.js App Router
- TypeScript with strict mode
- Tailwind CSS
- accessible component architecture
- use a mature component system such as shadcn/ui where appropriate
- TanStack Query where client-side server-state management is useful
- React Hook Form + Zod for complex forms
- TanStack Table for advanced administration tables

Backend:
- Python
- Django
- Django REST Framework
- PostgreSQL
- Redis
- Celery
- OpenAPI generation
- pytest

Infrastructure:
- Docker Compose for local dependencies
- PostgreSQL
- Redis
- S3-compatible object-storage abstraction; MinIO may be used locally
- production must not depend specifically on MinIO

Developer tooling:
- Git
- pnpm
- modern Python dependency management such as uv
- Ruff
- Python static type checking
- ESLint
- Prettier
- frontend type checking
- pytest
- frontend unit/component tests
- Playwright later for E2E
- pre-commit hooks if practical

### VERSION POLICY

Before installing dependencies, check current official stable/security-supported versions.

Do NOT blindly choose versions based on model training knowledge.

Prefer:
- patched supported releases
- LTS releases where that materially improves operational stability
- compatible package combinations

Avoid:
- alpha
- beta
- canary
- release candidate
- abandoned dependencies

Create:

docs/stack.md

Document:
- chosen versions
- why they were selected
- support/LTS considerations
- compatibility considerations

### Repository layout

Use a monorepo approximately like:

/
  apps/
    web/
    api/

  docs/
    architecture.md
    security.md
    authorization.md
    data-model.md
    testing.md
    deployment.md
    progress.md
    stack.md

  infra/

  .github/
    workflows/

  AGENTS.md
  README.md
  .gitignore
  .env.example

Backend should internally be modular:

apps/api/
  config/
  apps/
    accounts/
    platform_access/
    sellers/
    permissions/
    catalog/
    inventory/
    orders/
    payments/
    payouts/
    shipping/
    returns/
    promotions/
    reviews/
    notifications/
    analytics/
    audit/

Do not create unnecessary Django apps if they contain no code yet. Document the intended modules and create them as needed in later phases.

Frontend should be feature-oriented, not a giant components directory.

Example:

apps/web/
  app/
  features/
  components/
    ui/
  lib/
    api/
    auth/
    permissions/
  types/

### Architectural style

Use a MODULAR MONOLITH.

Do NOT introduce:
- microservices
- Kafka
- Kubernetes
- event sourcing everywhere
- multiple databases
- distributed transactions

unless a later requirement genuinely requires them.

Design domain boundaries so services could be extracted later without prematurely creating distributed systems.

### Backend coding architecture

Avoid fat DRF views and fat serializers.

Use clear layers where useful:

API/View
  ↓
Serializer / DTO validation
  ↓
Service / use-case layer
  ↓
Domain/model operations

For complex reads:

API
  ↓
Selector/query layer
  ↓
ORM

Business logic must not live primarily in:
- React components
- DRF serializers
- signals
- model save() methods

Small model invariants are acceptable.

Use explicit application services for meaningful workflows.

### Authentication architecture

Browser authentication must use Django as the authentication authority.

Default architecture:

- server-side Django sessions
- Secure session cookie in production
- HttpOnly session cookie
- appropriate SameSite policy
- CSRF protection for every unsafe browser request
- HTTPS required in production
- session rotation on authentication
- logout invalidates the session
- no authentication tokens in localStorage
- no authentication tokens in sessionStorage
- no long-lived browser bearer tokens

Create explicit endpoints such as:

GET  /api/v1/auth/csrf
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me

Use Django's authentication mechanisms correctly.

Do not disable CSRF to make development easier.

Design local development so the web frontend can access Django through a same-origin/proxy-style setup where practical.

Mobile/public API token authentication may be added in the future but is NOT needed now.

### User architecture

Create a custom User model FROM THE BEGINNING.

Login identifier:
- email

Do not depend on Django username.

Use normalized unique email addresses.

Use a strong password hasher such as Argon2 if supported by the chosen stack.

Configure robust password validation.

### Platform administrator model

Do not use Django `is_superuser` as normal business authorization.

Django superuser should be considered a BREAK-GLASS infrastructure account.

Application platform administrators should use application-level roles/permissions.

Future platform roles should support things such as:

SUPER_ADMIN
OPERATIONS_ADMIN
FINANCE_ADMIN
CATALOG_ADMIN
SUPPORT_ADMIN

We may initially expose only SUPER_ADMIN.

### Tenant architecture

The primary tenant is:

Seller

Users receive access through:

SellerMembership

Never model seller access using only:

User.is_seller

or:

User.seller_id

A user may eventually belong to multiple sellers.

Required conceptual structure:

User
Seller
SellerMembership
Role
Permission
RolePermission

Seller-owned data must always include explicit tenant ownership.

### Authorization invariant

THE BACKEND IS THE SECURITY BOUNDARY.

Frontend route guards exist only for user experience.

Never trust:
- hidden buttons
- frontend roles
- route visibility
- IDs supplied by the browser

Every sensitive backend operation must independently verify authorization.

Default permission philosophy:

DENY BY DEFAULT.

### Tenant isolation invariant

Seller A must never be able to:

- read Seller B data
- enumerate Seller B data
- modify Seller B data
- reference Seller B resources
- infer sensitive Seller B information from errors

Avoid unrestricted patterns such as:

Model.objects.get(id=request.data["id"])

inside seller endpoints.

Tenant filtering must be centralized in:
- selectors
- scoped managers/querysets
- permission classes
- application services

where appropriate.

Every seller-owned feature must include negative cross-tenant tests.

### ID strategy

Do not expose predictable database IDs unnecessarily.

Use UUID-based public identifiers for externally addressable business entities unless there is a documented reason otherwise.

Human-readable order numbers and similar identifiers may exist separately.

### Financial security invariant

Financial records must not be reconstructed from mutable current configuration.

When money-related events occur, snapshot:
- prices
- taxes
- discounts
- commissions
- totals
- currency

Use append-oriented/immutable ledger entries for seller financial activity.

Do not modify historical ledger records in place.

Corrections should generate compensating entries.

### Inventory security/integrity invariant

Inventory must eventually use an inventory ledger.

Do not model inventory only as:

Product.stock

Stock adjustments must be attributable and auditable.

### Order architecture invariant

A marketplace checkout can contain multiple sellers.

Use:

Order
  ├── SellerOrder
  └── SellerOrder

Seller dashboards operate on SellerOrder.

Sellers must not automatically receive access to unrelated portions of the parent Order.

### Audit invariant

Security-sensitive and business-sensitive operations must eventually generate AuditLog entries.

Examples:
- login events
- seller suspension
- role changes
- permission changes
- product moderation
- order status changes
- inventory adjustments
- refund actions
- payout actions

Audit entries should be append-only from normal application code.

### Secrets

Never commit:
- passwords
- API keys
- Django SECRET_KEY
- database credentials
- private keys
- production tokens

Provide `.env.example` containing names and safe placeholders only.

Generate development secrets locally where required.

### Logging

Never log:
- passwords
- session cookies
- CSRF tokens
- authorization headers
- full bank account information
- secrets
- private keys

Use structured logging where practical.

### Dependency rule

Before introducing a new dependency:

1. determine whether the standard framework already solves the problem;
2. verify the dependency is actively maintained;
3. explain important security-sensitive dependencies in docs/stack.md.

Avoid dependency bloat.

### Database rule

PostgreSQL is authoritative.

Use:
- foreign keys
- uniqueness constraints
- check constraints
- indexes
- database transactions

where appropriate.

Do not rely only on application validation for important invariants.

### Transaction rule

Critical workflows such as:

- inventory reservation
- order transitions
- refund accounting
- commission creation
- payouts

must eventually use database transactions and locking where race conditions are possible.

### Django signals

Do not build core business workflows around large chains of Django signals.

Signals may be used for small decoupled technical concerns.

Prefer explicit services and, later, transaction/on-commit events or an outbox strategy for important asynchronous work.

### API conventions

Use:

/api/v1/auth/*
/api/v1/seller/*
/api/v1/admin/*

Seller APIs and admin APIs may use the same domain services but should have intentionally different:
- authorization
- serializers
- selectors
- exposed fields

Generate OpenAPI documentation.

Use consistent:
- pagination
- filtering
- ordering
- validation errors
- error responses

### API safety

Protect against:
- mass assignment
- IDOR/BOLA
- insecure object references
- unrestricted filtering
- excessive page sizes
- dangerous file uploads
- unsupported content types

Never expose fields simply because they exist on a Django model.

Explicitly define API fields.

### Security headers

Plan for:
- Content-Security-Policy
- HSTS in production
- X-Content-Type-Options
- Referrer-Policy
- secure frame/embed policy
- secure cookie attributes

Do not enable production HSTS in local development.

### File uploads

Future uploaded files must:
- have size limits
- have allowlisted MIME/extensions
- use generated object names
- never trust original filenames
- be stored outside executable application directories
- support malware scanning integration later
- not become publicly accessible accidentally

### Async jobs

Use Celery later for:
- email
- notifications
- exports
- imports
- image processing
- reconciliation
- webhooks
- analytics aggregation

Never enqueue a task before a database transaction commits when doing so could create inconsistent behavior.

Use transaction.on_commit or an equivalent strategy.

### Testing philosophy

Every phase must add tests.

Tests must include negative cases.

NEVER make a failing test pass by weakening or deleting the assertion unless the test itself is demonstrably incorrect and the reason is documented.

Critical areas eventually need tests for:

- authentication
- CSRF
- authorization
- cross-tenant isolation
- privilege escalation
- order state transitions
- financial calculations
- inventory race conditions
- invalid input
- rate limiting
- sensitive field exposure

### Git

Initialize Git if necessary.

Make small coherent changes.

Do NOT rewrite unrelated files.

### Documentation

Create and maintain:

AGENTS.md
docs/architecture.md
docs/security.md
docs/authorization.md
docs/data-model.md
docs/testing.md
docs/progress.md

AGENTS.md should capture the persistent engineering rules above so future Codex work follows them even if conversation context is lost.

`docs/progress.md` should include:

Completed
In progress
Next phase
Known issues
Technical debt
Security considerations

### PHASE 0 IMPLEMENTATION

For this phase only:

1. initialize repository structure;
2. create AGENTS.md;
3. write architecture/security documentation;
4. initialize Next.js frontend;
5. initialize Django backend;
6. configure development dependency management;
7. configure PostgreSQL/Redis Docker Compose;
8. configure environment variable structure;
9. configure linting/formatting/type checking;
10. add basic health endpoints;
11. establish API versioning;
12. establish frontend/backend development proxy strategy;
13. create minimal automated tests proving each application starts;
14. add Makefile/task runner commands if useful;
15. write README startup instructions.

Do NOT implement marketplace business domains yet.

Run all relevant checks.

At completion, print:

PHASE 0 COMPLETE

Then report:
- files created
- stack versions
- architecture decisions
- commands to start development
- tests/checks executed
- any warnings

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.

After the Phase 0 completion gate succeeds, advance `CURRENT_PHASE.md` to Phase 1 and continue automatically.


# PHASE 1 — Secure identity, authentication, sessions, and platform access

Continue from the existing repository.

Read AGENTS.md and all relevant docs before modifying code.

Complete this phase fully before advancing through the completion gate to the next phase.

Build the authentication and identity foundation.

### Implement

Custom User model using email authentication.

Suggested fields:

id
email
first_name
last_name
is_active
is_email_verified
last_login
created_at
updated_at

Use UUID identifiers where appropriate.

Do not use username as the login identity.

Implement secure Django session authentication.

Endpoints:

GET /api/v1/auth/csrf
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET /api/v1/auth/me
POST /api/v1/auth/change-password

Prepare architecture for:
- forgot password
- reset password
- email verification
- MFA

but only implement them now if they can be done correctly without fake infrastructure.

### Session security

Implement and test:
- HttpOnly session cookies
- Secure production cookies
- correct SameSite configuration
- CSRF protection
- session rotation on login
- session invalidation on logout
- reasonable session expiry
- HTTPS assumptions documented

Never store session/auth tokens in browser localStorage.

### Password security

Use strong supported password hashing.

Configure Django password validators.

Ensure password values never appear in logs or API responses.

### Login abuse controls

Add robust login throttling / brute-force protection using a maintained approach.

Requirements:
- rate limit repeated failed authentication attempts
- avoid permanently locking legitimate users without recovery
- record relevant security events
- do not leak whether an account exists unnecessarily

### Platform access

Create application-level platform access.

Do NOT use Django superuser as the ordinary Super Admin authorization model.

Create an approach supporting platform roles, starting with:

SUPER_ADMIN

Design so these can be added later:

OPERATIONS_ADMIN
FINANCE_ADMIN
CATALOG_ADMIN
SUPPORT_ADMIN

Create explicit platform permissions.

### Break-glass administration

Document the purpose of Django superuser:
- infrastructure emergency
- not normal business operations

If Django admin is enabled:
- treat it as development/break-glass infrastructure
- do not make it the main platform interface
- document production restriction requirements

### Tests

Add tests proving:
- valid login
- invalid login
- disabled account rejected
- logout invalidates authentication
- CSRF is required on unsafe session-authenticated operations
- session changes appropriately after login
- anonymous requests cannot access protected endpoints
- regular user cannot access platform admin APIs
- SUPER_ADMIN can access a protected test endpoint
- sensitive password/hash fields never appear in responses
- brute-force protections work

Update OpenAPI docs.

Update security and authorization docs.

Run:
- backend tests
- formatting
- linting
- static checks

Finish by printing:

PHASE 1 COMPLETE

Summarize the work, complete the validation, documentation, commit, and GitHub push gate above, then continue directly to Phase 2.


# PHASE 2 — Seller tenancy, memberships, roles, and RBAC

Read AGENTS.md first.

Implement the multi-tenant authorization foundation.

### Entities

Seller

Fields should include approximately:

id
legal_name
display_name
slug
status
verification_status
email
phone
default_currency
timezone
created_at
updated_at
approved_at
approved_by

Statuses:

PENDING
ACTIVE
SUSPENDED
REJECTED
CLOSED

SellerMembership

id
seller
user
role
status
invited_by
joined_at
created_at

Unique:
seller + user

Membership statuses:

INVITED
ACTIVE
SUSPENDED

Role

Permission

RolePermission

Support seller-defined/custom roles later.

Seed system seller roles:

OWNER
ADMIN
CATALOG_MANAGER
ORDER_MANAGER
WAREHOUSE_MANAGER
FINANCE_MANAGER
SUPPORT_AGENT

### Permission naming

Use capability names such as:

seller.settings.read
seller.settings.update

staff.read
staff.invite
staff.update
staff.remove

catalog.product.read
catalog.product.create
catalog.product.update
catalog.product.archive

inventory.read
inventory.adjust

orders.read
orders.update
orders.cancel

finance.read
payouts.read

analytics.read

Do not scatter role-name conditionals throughout code.

Prefer permission checks.

### Current seller context

Implement a secure mechanism for identifying which Seller a user is operating as.

A user may eventually belong to multiple sellers.

Do not trust arbitrary seller IDs supplied in sensitive requests.

Validate membership on every seller-context change.

### Tenant-scoped access

Create reusable:
- permission helpers
- selectors/querysets
- service guards

for seller-owned data.

### Critical negative tests

Create Seller A and Seller B fixtures.

Prove Seller A cannot:
- read Seller B resources
- update Seller B resources
- delete Seller B resources
- enumerate Seller B resources
- assign themselves into Seller B
- grant permissions they are not authorized to grant

Test horizontal and vertical privilege escalation.

Use 404 vs 403 intentionally and consistently so resource existence is not leaked unnecessarily.

### Platform override

Platform SUPER_ADMIN may inspect seller data through ADMIN endpoints only.

Do not silently let admin privilege leak through seller endpoints unless explicitly designed.

Update docs.

Run full checks.

Print:

PHASE 2 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 3 — Next.js authentication shell and admin application foundation

Read AGENTS.md and backend API schema.

Build the frontend application shell.

Do not build catalog/orders/etc yet.

### Routes

Create separate route groups/layouts for:

/login

/seller/*
/admin/*

Create:
- Seller layout
- Super Admin layout
- responsive navigation
- breadcrumbs
- account menu
- loading states
- standardized error states
- 403 screen
- 404 screen

### Auth integration

Integrate with Django session auth.

Implement:
- CSRF acquisition
- credentials-enabled API requests
- login
- logout
- current-user retrieval

Do NOT use:
- localStorage tokens
- sessionStorage tokens

### Authorization

Frontend authorization exists only for UX.

It may:
- hide unauthorized navigation
- redirect obviously unauthorized users
- conditionally render actions

But Django remains authoritative.

Create reusable permission utilities.

### API client

Create a typed centralized API client.

Requirements:
- standard error parsing
- authentication handling
- CSRF handling
- pagination typing
- request IDs if available
- no silent swallowing of authorization errors

Do not scatter raw fetch calls throughout components.

### UI foundation

Create reusable admin components:

DataTable
PageHeader
EmptyState
ConfirmDialog
StatusBadge
FormField wrappers
Pagination
FilterBar
SearchInput
Date display
Money display
Skeletons
ErrorBoundary strategy

Ensure keyboard accessibility.

### Tests

Test:
- successful login
- rejected login
- logout
- seller/admin route handling
- permission-based UI visibility
- API errors
- TypeScript strictness

Run:
pnpm lint
pnpm typecheck
frontend tests
pnpm build

Print:

PHASE 3 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 4 — Seller onboarding and Super Admin seller management

Implement seller lifecycle management.

### Additional entities

SellerProfile
SellerAddress
SellerDocument
SellerStatusHistory
SellerSettings

SellerDocument approximately:

id
seller
document_type
file
document_number
status
verified_by
verified_at
rejection_reason
expires_at
created_at

Never expose private verification data unnecessarily.

### Super Admin functionality

/admin/sellers

Features:
- paginated list
- search
- status filter
- verification filter
- seller detail page
- seller profile
- membership overview
- submitted documents
- approve seller
- reject seller with reason
- suspend seller with reason
- reactivate seller
- status history
- audit history

All state changes must use explicit service-layer commands.

Do not expose arbitrary model PATCH behavior for approval/suspension.

Suggested endpoints:

POST /api/v1/admin/sellers/{id}/approve
POST /api/v1/admin/sellers/{id}/reject
POST /api/v1/admin/sellers/{id}/suspend
POST /api/v1/admin/sellers/{id}/reactivate

### Seller settings

/seller/settings

Allow only permitted seller fields.

Never allow sellers to modify:
- approval state
- verification status
- commission settings
- system-owned fields

### Audit

Record:
actor
action
seller
target entity
before/after safe diff
timestamp
request metadata where appropriate

Do not log sensitive document contents.

### Tests

Include:
- unauthorized seller approval attempt
- self-approval impossible
- suspended seller access behavior
- Seller A cannot modify Seller B
- allowed seller profile update
- protected fields cannot be mass-assigned
- audit records generated

Print:

PHASE 4 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 5 — Catalog, categories, attributes, products, and variants

Implement catalog management.

### Platform-managed entities

Category

id
parent
name
slug
description
sort_order
is_active

Support hierarchical categories.

Brand

Attribute

AttributeOption

CategoryAttribute

Do not hardcode category-specific columns such as:
color
size
ram
storage

Build configurable attributes.

### Seller-owned catalog

For the initial version, products are seller-owned.

Product:

id
seller
category
brand
name
slug
description
short_description
status
created_by
approved_by
approved_at
created_at
updated_at

Statuses:

DRAFT
PENDING_REVIEW
ACTIVE
REJECTED
ARCHIVED

ProductVariant:

id
product
sku
barcode
price
compare_at_price
cost_price
weight
length
width
height
status

SKU uniqueness should be correctly scoped/documented.

ProductImage

ProductAttributeValue

VariantAttributeValue

### Money

Never use floating point for currency.

Use decimal types with documented precision.

Validate:
- non-negative values
- compare_at_price relationships
- currency handling

### APIs

Seller:
/api/v1/seller/products/*

Admin:
/api/v1/admin/catalog/*
/api/v1/admin/products/*

Admin manages:
- categories
- brands
- attributes
- moderation

Seller manages only their own products.

### Product moderation

Use explicit actions:

submit-for-review
approve
reject
archive

Implement legal state transitions.

### Frontend

Seller:
- products table
- create product
- edit product
- variants
- images
- attributes
- status history

Admin:
- category management
- attribute management
- product moderation queue

### File safety

Product images must obey safe upload validation.

### Tests

Heavy tenant-isolation testing.

Also test:
- invalid category
- attributes belonging to wrong category
- Seller A editing Seller B product
- forbidden status transitions
- seller self-approval impossible
- decimal validation
- duplicate SKU behavior
- file validation

Print:

PHASE 5 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 6 — Warehouses and inventory ledger

Implement inventory properly.

### Entities

Warehouse

id
seller
name
code
address
is_active
created_at

Inventory

id
warehouse
variant
quantity_on_hand
quantity_reserved
reorder_level
updated_at

Database uniqueness:
warehouse + variant

Available quantity conceptually:

quantity_on_hand - quantity_reserved

InventoryTransaction

id
inventory
type
quantity_delta
reference_type
reference_id
reason
created_by
created_at

Transaction types:

PURCHASE
SALE
RETURN
ADJUSTMENT
RESERVATION
RELEASE

### Critical rule

InventoryTransaction is an audit ledger.

Do not silently mutate stock without a corresponding ledger event.

Use services such as:

adjust_inventory()
reserve_inventory()
release_inventory()
consume_reserved_inventory()
receive_return()

### Concurrency

Use database transactions and locking where needed.

Prevent:
- overselling caused by concurrent requests
- negative reserved quantity
- invalid stock state

### Seller frontend

/seller/inventory
/seller/warehouses
/seller/inventory/adjustments

Show:
- on hand
- reserved
- available
- low stock
- transaction history

### Tests

Include concurrency/integrity tests where practical.

Prove:
- Seller A cannot use Seller B warehouse
- Seller A cannot adjust Seller B inventory
- negative invalid states fail
- ledger transaction exists for adjustment
- reservations cannot exceed availability
- transaction rollback preserves consistency

Print:

PHASE 6 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 7 — Marketplace orders and secure state machines

Implement multi-seller order architecture.

This phase focuses on administration/backend modeling, not customer checkout UX.

### Entities

Order

id
order_number
customer reference strategy
subtotal
discount_total
tax_total
shipping_total
grand_total
payment_status
fulfillment_status
billing_address_snapshot
shipping_address_snapshot
created_at

SellerOrder

id
order
seller
seller_order_number
subtotal
discount_total
tax_total
shipping_total
commission_total
seller_net_total
status
created_at
updated_at

OrderItem

id
seller_order
product
variant

product_name_snapshot
sku_snapshot
variant_snapshot

quantity
unit_price
discount_amount
tax_amount
total
commission_amount
seller_net_amount

### Immutable snapshots

Historical orders must not change when:
- product name changes
- SKU changes
- price changes
- commission changes

### State machine

Use explicit valid transitions.

Example:

PENDING
CONFIRMED
PROCESSING
SHIPPED
DELIVERED

Exceptional:

PENDING -> CANCELLED

and later return states.

Do not create a generic endpoint where callers freely assign `status`.

Create explicit application actions such as:

confirm
begin-processing
ship
deliver
cancel

Validate transitions on backend.

### Authorization

Seller sees their SellerOrder.

Seller must not gain broad access to unrelated SellerOrders from the same parent Order.

Admin can view platform-wide order structure.

### Inventory integration

Order reservation/confirmation/cancellation must integrate safely with inventory transactions.

Use atomic transactions.

### Audit

Every status transition gets audit/history information.

### Frontend

Seller:
/seller/orders
/seller/orders/[id]

Admin:
/admin/orders
/admin/orders/[id]

Include:
- timeline
- items
- totals
- status
- seller context
- audit information appropriate to audience

### Tests

Test:
- cross-seller order isolation
- invalid transitions
- double transition requests
- cancellation releases inventory
- concurrent confirmation safety
- snapshots immutable
- totals use Decimal
- seller cannot alter financial totals
- seller cannot mark arbitrary other seller order delivered

Print:

PHASE 7 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 8 — Commission engine and seller financial ledger

Implement marketplace financial accounting carefully.

Do NOT integrate a real payment provider yet unless already explicitly configured.

### Entities

CommissionPlan

id
name
default_percentage
is_active

CommissionRule

plan
seller nullable
category nullable
percentage
fixed_fee
priority/effective logic
effective dates if useful

SellerLedgerEntry

id
seller
type
amount
currency
seller_order
payment reference nullable
payout reference nullable
description
created_at

Types:

SALE
COMMISSION
REFUND
PAYOUT
ADJUSTMENT

Design append-oriented records.

Payout

id
seller
amount
currency
status
period_start
period_end
created_at
approved_at
processed_at

PayoutItem

### Critical accounting rules

Historical commission is snapshotted.

Changing a commission plan must never rewrite old orders.

Never edit historical ledger entries to "fix" accounting.

Create compensating entries.

Use database transactions.

### Platform permissions

Finance operations require explicit permissions.

A seller may:
- see their balance
- see their transactions
- see their commission
- see payout history

A seller cannot:
- alter ledger entries
- approve their payout
- alter commission rules

### Frontend

Seller:
/seller/finance
/seller/finance/transactions
/seller/finance/payouts

Admin:
/admin/finance
/admin/finance/commissions
/admin/finance/seller-balances
/admin/finance/payouts

### Tests

Test:
- commission calculation
- rounding
- seller-specific rule
- category rule
- default rule
- historical immutability
- cross-seller finance isolation
- seller cannot modify ledger
- unauthorized platform admin cannot approve payout
- duplicate payout processing protection

Print:

PHASE 8 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 9 — Shipping, fulfillment, returns, and refunds

Implement fulfillment architecture.

### Entities

ShippingMethod
ShippingZone
ShippingRate

Shipment

seller_order
carrier
tracking_number
status
shipped_at
delivered_at

ShipmentItem

TrackingEvent

ReturnRequest

ReturnItem

ReturnStatusHistory

Refund

RefundTransaction

### Requirements

A SellerOrder may have its own shipment independent of other sellers in the parent Order.

Returns operate against individual OrderItems.

Use explicit return workflow.

Suggested:

REQUESTED
APPROVED
REJECTED
IN_TRANSIT
RECEIVED
REFUND_PENDING
REFUNDED
CLOSED

Do not allow arbitrary status assignment.

### Financial integration

Refunds must correctly generate:
- payment/refund records
- financial ledger effects
- commission reversal behavior according to documented policy

Never delete original transaction history.

### Inventory integration

Accepted/received returns may create inventory transactions where appropriate.

### Tests

Cover:
- partial returns
- cross-seller attacks
- refund idempotency
- invalid quantities
- duplicate refund prevention
- ledger consistency
- inventory consistency
- state transitions

Print:

PHASE 9 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 10 — Promotions, reviews, seller staff management, and notifications

Implement the supporting administration modules.

### Promotions

Entities:

Promotion
Coupon
CouponUsage
PromotionProduct
PromotionCategory
PromotionSeller

Promotion ownership/scope:

PLATFORM
SELLER

Backend determines:
- eligibility
- stacking
- date validity
- usage limits
- seller boundaries

Do not trust discount amounts calculated by frontend.

### Reviews

ProductReview

customer
product
order_item
rating
title
body
status
verified_purchase
created_at

ReviewReport
ReviewModeration
SellerReviewResponse if desired

Seller may:
- view reviews
- respond
- report

Seller should not directly delete unfavorable legitimate reviews.

Admin controls moderation.

### Seller staff

Build:

/seller/staff
/seller/staff/roles

Support:
- invite user
- revoke membership
- change role
- custom role permissions if architecture already supports them

Prevent privilege escalation.

A staff member must not grant permissions they themselves are forbidden from managing.

Protect OWNER semantics carefully.

### Notifications

Create notification infrastructure.

Use async jobs for delivery.

Do not let notification failures roll back business transactions.

Print:

PHASE 10 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 11 — Seller dashboard, Super Admin dashboard, and analytics

Now build the operational dashboards.

Do not create fake metrics disconnected from authoritative queries.

### Seller dashboard

Include:

Gross sales
Net sales
Orders
Average order value
Units sold
Pending orders
Low-stock variants
Returns
Platform fees
Available balance
Pending balance
Payout information
Top products
Sales-over-time chart

Every metric MUST be scoped to the current seller.

### Super Admin dashboard

Include:

GMV
Platform revenue
Commission revenue
Orders
Active sellers
Pending seller approvals
Customers if available
Refund rate
Return rate
Average order value
Outstanding seller balances
Upcoming payouts
New seller registrations
Top categories
Top sellers by descriptive metrics

### Analytics implementation

Avoid expensive live queries where appropriate.

Start with correct indexed aggregate queries.

Create materialized/preaggregated approaches only where measurements justify them.

Make date-range filtering explicit.

Timezones must be handled intentionally.

### Security

Never leak platform-wide analytics through seller APIs.

### Frontend quality

Responsive layouts.

Accessible charts.

Loading and empty states.

No huge client-side datasets.

Server-side pagination/filtering.

Print:

PHASE 11 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 12 — Security hardening pass

Stop feature development.

Perform a dedicated security review of the current codebase.

Read:
- AGENTS.md
- docs/security.md
- authorization docs
- all API routes
- middleware
- settings
- auth services
- upload logic

### Threat model

Document threats for:

Authentication
Session theft
CSRF
XSS
IDOR/BOLA
Broken access control
Tenant escape
Privilege escalation
Mass assignment
SQL injection
File upload attacks
Brute force
Rate-limit bypass
Sensitive-data exposure
Security misconfiguration
SSRF where applicable
Open redirects
Unsafe deserialization
Webhook spoofing when applicable
Replay/idempotency problems
Race conditions
Financial tampering

### Django hardening

Review production settings including:

DEBUG=False
ALLOWED_HOSTS
CSRF_TRUSTED_ORIGINS
secure cookies
HTTPS redirect assumptions
HSTS
proxy SSL headers
X-Content-Type-Options
frame policy
Referrer-Policy

Do not create settings that break local development.

Separate environment-specific settings where useful.

### Frontend hardening

Implement/review:

Content-Security-Policy
no unsafe secret exposure
no server secrets in NEXT_PUBLIC variables
safe rendering
safe external URLs
no dangerous HTML unless strictly sanitized
dependency security

### Authorization audit

Enumerate every `/api/v1/seller/` endpoint.

For each endpoint verify:

authentication
seller membership
required permission
tenant filtering
object-level check
protected fields
negative tests

Do the equivalent for `/api/v1/admin/`.

Produce:

docs/security-audit.md

### Rate limiting

Review rate limits for:
- login
- password actions
- invitations
- exports
- sensitive admin operations
- expensive searches

### Security tests

Add adversarial tests including:

Seller A reading Seller B object
Seller A modifying Seller B object
Seller A submitting Seller B foreign key
Seller staff escalating own role
Seller owner changing platform fields
Normal user calling admin API
Admin role calling unauthorized finance API
Mass assignment attempts
CSRF omission
tampered IDs
pagination abuse
invalid file uploads
replayed sensitive actions
duplicate financial actions

### PostgreSQL RLS evaluation

Evaluate PostgreSQL Row Level Security as defense-in-depth for the most critical tenant-owned tables.

Do NOT blindly add RLS.

Create:

docs/rls-evaluation.md

Explain:
- benefits
- operational complexity
- Celery implications
- admin implications
- migration strategy
- whether to adopt it now

Only implement RLS if it can be done correctly and comprehensively without creating inconsistent authorization behavior.

Application-level tenant isolation remains mandatory either way.

### Dependency audit

Check for known dependency vulnerabilities using appropriate ecosystem tools.

Upgrade vulnerable dependencies to compatible patched versions.

Do not perform uncontrolled major upgrades.

Print:

PHASE 12 COMPLETE

Provide a security findings summary categorized:

Critical
High
Medium
Low
Informational

All Critical/High issues discovered in code controlled by this repository should be fixed before completion unless there is a documented blocker.

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 13 — Comprehensive testing, race conditions, E2E, and performance

Focus on proving correctness.

### Backend

Expand:
- unit tests
- service tests
- API integration tests
- authorization tests
- tenant-isolation tests
- transaction tests

### Frontend

Expand:
- component tests
- permission rendering tests
- forms
- tables
- error handling

### Playwright E2E

Implement high-value flows:

1. Super Admin login
2. Approve seller
3. Seller owner login
4. Create product
5. Create variant
6. Adjust inventory
7. View seller order
8. Process permitted order transition
9. View finance ledger
10. Verify Seller A cannot access Seller B resource
11. Verify normal seller cannot access /admin
12. Logout invalidates session

### Race-condition tests

Test where practical:

inventory reservation
duplicate order transition
duplicate refund
duplicate payout
concurrent inventory adjustment

### Performance

Analyze:
- N+1 queries
- missing indexes
- unbounded API results
- oversized serializers
- dashboard query counts

Use select_related/prefetch_related intentionally.

Do not optimize blindly.

Document measurements.

### Test commands

Create one documented command capable of running the complete validation suite.

For example conceptually:

make check

It should run the appropriate combination of:

backend tests
backend lint
backend formatting check
backend types
frontend lint
frontend typecheck
frontend tests
frontend production build

E2E may be a separate command if environment setup requires it.

Print:

PHASE 13 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 14 — Observability, background jobs, and operational resilience

Add production-operability foundations.

### Structured logging

Include:
- timestamp
- level
- request ID
- user ID where safe
- seller ID where safe
- route
- status
- latency

Never log secrets.

### Request IDs

Generate/propagate correlation IDs.

Return useful request IDs in error responses where appropriate.

### Error monitoring abstraction

Prepare integration for a production error-monitoring service without hardcoding credentials.

### Celery

Configure workers correctly.

Add reliable task patterns.

Tasks must:
- be idempotent where required
- have appropriate retries
- avoid retry storms
- have timeouts
- handle transaction commit ordering
- log safely

### Outbox evaluation

For critical events such as:
- order events
- payout events
- external webhooks

evaluate an outbox pattern.

Implement only if justified.

### Health checks

Provide:

liveness
readiness

Readiness should assess critical dependencies appropriately without causing excessive load.

### Audit retention

Document retention and archival considerations.

Print:

PHASE 14 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 15 — Production deployment architecture and CI/CD

Prepare the repository for production deployment without assuming a specific cloud vendor.

### Containers

Create secure production Dockerfiles.

Requirements:
- minimal runtime images
- non-root processes
- dependency pinning/lockfiles
- no secrets baked into images
- reasonable health checks
- multi-stage builds where useful

### Services

Target conceptual production architecture:

Internet
  ↓
CDN/WAF
  ↓
Reverse Proxy / Load Balancer
  ├── Next.js
  └── /api -> Django

Django
  ├── PostgreSQL
  ├── Redis
  ├── Celery workers
  └── Object storage

Use same-origin routing where practical:

https://example.com/*
https://example.com/api/*

### CI

Create CI that runs:

backend formatting/lint
backend type checks
backend tests
migration checks
frontend lint
frontend type checks
frontend tests
frontend production build
dependency/security checks

Do not deploy if required checks fail.

### Migrations

Document safe production migration procedure.

Avoid unsafe assumptions about:
- table locks
- large backfills
- destructive migrations

### Backups

Document:
- PostgreSQL backups
- restore testing
- object-storage backup/versioning
- encryption
- retention

### Secrets

Document using an external secret manager in production.

Never put production values in repository files.

### Deployment docs

Complete:

docs/deployment.md
docs/runbook.md
docs/backup-restore.md

Print:

PHASE 15 COMPLETE

Complete the validation, documentation, commit, and GitHub push gate above, then continue directly to the next numbered phase.


# PHASE 16 — Final architecture and security audit

Perform a final repository-wide review.

Do NOT add large new features.

### Review

Check:

architecture boundaries
tenant isolation
RBAC consistency
authentication
CSRF
session configuration
authorization
API schemas
financial integrity
inventory integrity
order state machines
audit logging
async task safety
dependency vulnerabilities
frontend security
production settings
database indexes
migration safety
tests
documentation

### Search for dangerous patterns

Search for things such as:

AllowAny on sensitive endpoints
permission_classes = []
csrf_exempt
raw SQL
Model.objects.get(id=...) in seller APIs without tenant scoping
unfiltered Model.objects.all()
hardcoded secrets
NEXT_PUBLIC secrets
localStorage auth
sessionStorage auth
unvalidated file uploads
float money calculations
generic status PATCH operations
financial record mutation
audit record mutation
catch-all exception swallowing
TODO security bypasses
debug settings
wildcard CORS
wildcard trusted origins

Investigate every match rather than blindly replacing text.

### Final documents

Update:

README.md
AGENTS.md
docs/architecture.md
docs/security.md
docs/authorization.md
docs/data-model.md
docs/testing.md
docs/deployment.md
docs/progress.md
docs/security-audit.md

Create:

docs/final-review.md

Include:

1. implemented features
2. architecture overview
3. security model
4. authentication design
5. tenant isolation strategy
6. RBAC design
7. financial integrity strategy
8. inventory integrity strategy
9. testing coverage
10. remaining technical debt
11. known risks
12. recommended next phases
13. production launch checklist

Run the COMPLETE test/check suite.

Do not hide failures.

Fix repository-controlled failures that can safely be fixed.

At completion print:

PROJECT FOUNDATION AUDIT COMPLETE

Then provide:

- test results
- security findings
- unresolved risks
- production readiness checklist
- recommended next development phase

Complete the final validation, documentation, commit, and GitHub push gate. Mark the roadmap complete and provide the final project report; there is no further defined phase.