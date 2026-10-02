# Project progress

## Completed

- Phase 0: monorepo, Next.js App Router/Tailwind and Django/DRF foundations, initial UUID/email user migration boundary, PostgreSQL/Redis development infrastructure, generated local environment, strict tooling, liveness endpoints and offline OpenAPI.
- Phase 1: server-side Django session authentication, explicit CSRF-protected browser login/logout, current-user and password-change APIs, brute-force lockout, immutable security events, application platform roles/capabilities, bootstrap management commands, and a real Next.js proxy smoke test.
- Phase 2: seller tenancy and UUID memberships, seven system seller roles, explicit capabilities and owner-delegation protection, per-request seller context, scoped selectors and service guards, read-only seller-access/platform-inspection endpoints, PostgreSQL cross-tenant/identity constraints and adversarial authorization tests.
- Phase 3: Next.js login/session integration, protected seller/admin/workspace/account layouts, responsive navigation/account menu/breadcrumbs, 403/404 and retry/loading states, centralized typed/runtime-validated same-origin API client, cancellation and stale-result protection, accessible UI primitives and frontend security/interaction tests.
- Phase 4: seller onboarding, profiles/settings/addresses, private validated verification scans and downloads, explicit platform review/lifecycle commands, seller-management screens, append-only business audits/status history and adversarial/concurrency tests.
- Phase 5: platform categories, brands, configurable attributes, category-attribute linking, seller-owned products, variants, attribute values, safe private image uploads and downloads, explicit moderation actions (submit-for-review, revise, archive, approve, reject), immutable status history, Decimal price validation and money displays, catalog screens for seller and platform, and adversarial tenant-isolation tests.
- Architecture, security, authorization, data-model, stack, testing, deployment and progress guidance are maintained alongside the implementation.

## Current phase

Phase 1 was committed as `56c1d72` and pushed; [its GitHub validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36666039048). Phase 2 was committed/pushed as `b563da6`; [its GitHub validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36668437445). Phase 3 was committed/pushed as `36ae824`; [its GitHub validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36672333932). Phase 4 was committed/pushed as `a3ed17a`; [its GitHub validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36865741475). Phase 5 catalog implementation is complete and locally validated.

## Phase 5 validation results

- `pnpm check`: passed. PostgreSQL backend suite: **221 passed** (including **51 catalog cases**); frontend suite: **68 passed** across seven files. Ruff format/lint, strict mypy (67 source files), Django checks, migration drift, warning-free offline OpenAPI, Prettier, ESLint (0 warnings), strict TypeScript and Next.js production build passed.
- Catalog test suite covers cross-tenant attacks on products/variants/images/attributes, foreign key scoping, mass assignment rejection, decimal price constraints and compare-at relationship, category hierarchy integrity, dynamic attribute scope and requirement rules, explicit review transitions, reason requirements, self-approval prevention, safe image MIME/size decoding, and storage compensation on transaction rollback.
- Compose configuration validation passed quietly through the Ubuntu WSL Docker daemon.

## Next phase

Phase 6: Warehouses and inventory ledger.

## Phase 4 implementation and validation

- Added seller onboarding, private verification documents, registered/returns addresses, profiles, support settings, explicit platform lifecycle/document review actions and immutable audit/history records.
- Added `/onboarding`, `/seller/settings`, `/admin/sellers` and `/admin/sellers/[id]` with API-backed forms, bounded lists, filters, private downloads, review confirmations and visible errors.
- Final `pnpm check`: passed, with **170 PostgreSQL backend tests** and **59 frontend tests** across six files. Ruff format/lint, strict mypy (58 source files), Django checks, migration drift, warning-free offline OpenAPI, Prettier, ESLint, strict TypeScript and production build all passed. The focused lifecycle suite includes **44 cases**, including concurrent approval and rollback/storage compensation.
- `pnpm smoke:auth` passed through the actual Next.js/Django proxy. Compose configuration validation and `git diff --check` passed. HTTP checks returned 200 with nosniff for the new onboarding/settings/platform list/detail shells; no confidential data is embedded behind client-only guards. Browser visual/E2E pass is not claimed.
- Initial test setup failed because the WSL foreground service session had ended; the services were restarted and PostgreSQL connectivity restored. A dialog test-environment failure was fixed by supplying jsdom's missing native methods for the duration of the suite; no application assertion was relaxed.
- Product policy: initial onboarding accepts JPEG/PNG scans (5 MiB / 12 megapixels), one pending document per type, 50 retained submissions per seller and ten owned sellers per account. PDFs and automated verification are not supported. Platform support handles rejected/closed registrations and evidence-cap exhaustion; there is no reopening or evidence-deletion API in Phase 4.
- Malware scanning and operational retention are deferred as specified by the roadmap. Storage and database are not a distributed transaction: ordinary failures compensate a new object; process death between storage write and DB commit can leave a private orphan. Reconciliation is an operational follow-up; no file becomes public.

## Phase 3 validation results

- Final `pnpm check`: passed. PostgreSQL backend suite: **122 passed**; frontend suite: **49 passed** across five files. Ruff format/lint, strict mypy, Django checks, migration drift/OpenAPI validation, Prettier, ESLint, strict TypeScript and Next.js production build passed.
- `pnpm smoke:auth`: passed against the actual Next.js/Django proxy, including CSRF denial, cookie attributes/rotation, password change, logout invalidation and replay denial. Compose configuration validation passed through WSL.
- Live HTTP checks: home/login/workspaces/seller/admin/account/403 routes returned 200 with nosniff; unknown route returned the custom 404. Protected HTTP responses contain only the shell; client session/permission validation and Django APIs control access to data.
- New tests caught and fixed cancellation handling for browser DOMException and ambiguous selectors; assertions were preserved. Async auth and tenant races are tested explicitly.
- No application dependencies or migrations were added. Browser visual/E2E checks are not claimed due to the environment limitations above.

## Phase 0 validation history

- `pnpm check`: passed; PostgreSQL **24 tests passed**, frontend **3 tests passed**, and lint/format/types/migration/schema/build checks passed.
- Compose, locked installation, liveness/production-routing smoke and production fail-closed checks passed. `pnpm audit --prod` reported no known vulnerabilities.
- [GitHub Linux validation passed](https://github.com/Beeplap/e-commerce/actions/runs/36590505157) for foundation commit `1014506`.

## Phase 2 validation results

- New PostgreSQL migrations applied successfully, including role seeds and integrity triggers.
- Strict mypy passed for 46 source files.
- Final `pnpm check`: passed. PostgreSQL backend suite: **122 passed**, including **67 seller-authorization cases**. Frontend suite: **3 passed**. Ruff formatting/lint, strict mypy, Django checks, migration drift, warning-free OpenAPI, Prettier, ESLint, TypeScript and Next.js production build passed.
- `pnpm smoke:auth`: passed through the actual Next.js development proxy after the shared browser-view validation changes.
- Compose configuration validation passed through the Ubuntu WSL Docker daemon. No dependencies were added in Phase 2.
- Schema enum collisions were fixed with explicit names derived from model choices; no warnings were suppressed and no test/security assertions were weakened.
