# Stack decisions

Official support pages and package registries were checked on 2026-09-29 before installation. Direct dependencies are pinned, and `pnpm-lock.yaml` plus `apps/api/uv.lock` capture transitive resolutions. Use stable releases only and recheck security advisories before deployment or upgrades.

## Runtime choices

- Node 24 LTS (local 24.15.0), pnpm 11.1.1: the installed LTS runtime/package manager provide reproducible workspace tooling. Node is constrained to the 24 line. [Node release policy](https://nodejs.org/en/about/previous-releases).
- Next.js 16.3.7 with React/React DOM 19.3.0: stable registry releases selected after reviewing the current Next.js security announcements. App Router, TypeScript strict mode, ESLint 9.39.5, and Tailwind CSS 4.3.3 establish the UI foundation. TypeScript 6.0.3 stays inside typescript-eslint's supported `<6.1` range; registry-latest TypeScript 7 is deliberately not selected. ESLint 9 is deprecated upstream, but the current Next config's React/import/accessibility plugins exclude ESLint 10 in their peer ranges. Keep the last compatible 9.x patch temporarily; do not suppress peer errors. Upgrade once those plugins support 10. This is development-tooling debt, not a production runtime dependency. [Next installation](https://nextjs.org/docs/app/getting-started/installation), [security updates](https://nextjs.org/blog).
- Python 3.14 (local 3.14.5), uv 0.12.20: supported stable Python with locked dependency management. No preview runtime is used. [uv installation](https://docs.astral.sh/uv/getting-started/installation/).
- Django 5.2.17 LTS: supported security maintenance through April 2028 favors operational stability over a newer short-lived feature series. DRF 3.18.1 supports the current Django/Python combination. [Django supported releases](https://www.djangoproject.com/download/), [DRF releases](https://www.django-rest-framework.org/community/release-notes/).
- PostgreSQL 18.6 (`postgres:18.6-bookworm`): supported major with patched minor release. Named volume mounts the PostgreSQL 18 image's `/var/lib/postgresql` parent directory. PostgreSQL is also the test database. [Version policy](https://www.postgresql.org/support/versioning/).
- Redis 8.2.10 (`redis:8.2.10-bookworm`): extended-support 8.2 branch, current patch, authentication required locally. Redis is provisioned but not yet an application dependency. [Redis version policy](https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/), [official releases](https://download.redis.io/releases/).

## Backend dependencies

- psycopg 3.3.6 with binary wheels provides maintained PostgreSQL access on Windows/Linux without machine-specific compiler requirements.
- argon2-cffi 25.1.0 supplies Django's memory-hard Argon2 password hasher; Django's PBKDF2 verifier remains available for future hash migration. Password validation uses Django's built-in validators, with a 12-character minimum.
- drf-spectacular 0.30.0 generates and validates OpenAPI from explicit serializers; no public documentation endpoint or extra browser UI dependency is needed yet. [Project maintenance and compatibility](https://pypi.org/project/drf-spectacular/).
- django-axes 8.3.1 provides maintained Django authentication-failure tracking, PostgreSQL-backed temporary lockout, expiry and a configurable DRF-compatible lockout response. It accepts Django 5.2 and requires no Django-admin UI. Its default client/IP/request metadata is reviewed and configured explicitly; the fixed lockout label disables identifying usernames in operational logs. [Axes 8.3.1 release](https://github.com/jazzband/django-axes/releases/tag/8.3.1), [configuration](https://django-axes.readthedocs.io/en/stable/4_configuration.html), [DRF integration](https://django-axes.readthedocs.io/en/stable/6_integration.html).
- Ruff 0.16.9, pytest 9.1.1, pytest-django 4.14.0, django-stubs 6.1.1, and DRF stubs 3.18.1 provide static/runtime validation. mypy is resolved through the stubs' compatible-mypy extra and pinned in uv.lock. Django stubs 6.1 explicitly lists partial support for Django 5.2 and supports Python 3.14; 5.2 stubs only list Python through 3.13. [Stub compatibility matrix](https://github.com/typeddjango/django-stubs#version-compatibility).

## Frontend tooling and deferred dependencies

Vitest 5.0.2, Testing Library React 16.3.3, jest-dom 7.0.1 and jsdom 30.1.1 test the foundation UI. Prettier 3.9.9 handles repository formatting. Native installation scripts are allowlisted for Tailwind oxide, esbuild, sharp and unrs-resolver; other dependency build scripts require deliberate review.

Phase 3 uses the existing React/Next.js/Tailwind/testing stack without additional packages. Simple forms, bounded semantic tables and a native modal dialog do not yet require form/table/component-state libraries. Runtime API validation is explicit for the small current contract; reassess a schema library when complex forms arrive. The bundled Next.js 16.3.7 guides/types were inspected for route groups, layout/client boundaries and the current error-boundary `retry` API. Browser E2E dependencies remain deferred to Phase 13.

No Celery, storage SDK, auth token package, CORS package, component library, TanStack, form library or client API abstraction is installed without a current use case. Their architectural locations are documented, and they should be introduced only in the relevant phase after maintenance/security checks. Django already provides sessions, CSRF, password hashing integration and validation.
