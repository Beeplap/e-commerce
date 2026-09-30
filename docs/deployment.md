# Development and future deployment

Phase 0 establishes local infrastructure and secure production settings, not a production deployment. Do not expose Django runserver or the local Compose database bootstrap credentials to the internet.

Local apps run natively with Node/pnpm and Python/uv; Docker Compose runs PostgreSQL and Redis. Named volumes persist across `down` and `up`. Removing volumes destroys local data and requires a deliberate operator action. Never add that action to normal setup or validation.

The target production topology is HTTPS ingress/CDN -> Next.js for pages and Django for `/api/*`, with private PostgreSQL, authenticated Redis, later Celery workers, and private S3-compatible object storage. Production must inject configuration through a secret manager and separate database migration/runtime privileges. No database, Redis or storage service should be publicly bound.

Set `DJANGO_SETTINGS_MODULE=config.settings.production`, a cryptographically random `DJANGO_SECRET_KEY` of at least 50 characters, explicit `DJANGO_ALLOWED_HOSTS`, explicit HTTPS-only `DJANGO_CSRF_TRUSTED_ORIGINS`, and the PostgreSQL connection variables. There are no fallback production credentials. ASGI/WSGI default to production; local management commands explicitly select development. Production storage TLS/database TLS/credentials and web server configuration must be specified when a deployment target is chosen.

Production settings enable HTTPS redirects, Secure cookies and one-year HSTS including subdomains, without preload. Ensure all subdomains are HTTPS-ready before launch. Django must receive correct secure-request information: if TLS terminates at ingress, configure `SECURE_PROXY_SSL_HEADER` only after ensuring the ingress strips untrusted forwarded headers, overwrites its own value and is Django's only network entry point. No such trust is enabled in Phase 0. Incorrect setup can produce redirect loops and CSRF failures; test the actual ingress before deployment.

The production Next.js app has no development rewrite. Configure `/api/*` at ingress and preserve Origin, cookies and appropriate host semantics. Implement a nonce-compatible CSP with the app shell and validate the policy in Phase 12. Configure request limits and monitoring redaction. Do not add permissive CORS or disable CSRF to repair routing.

The Phase 3 app shell uses relative same-origin API requests and browser sessions; there is no second Next.js auth store or token exchange. Public/protected shell pages may be statically built because they contain no private business records. Authentication and membership/capability APIs remain uncached and authoritative. If later server-rendered pages include private data, the server must authorize those Django calls before producing HTML/RSC; a client guard is insufficient. Production ingress must serve these API paths before login will work in the production build.

Phase 15 will add production non-root containers, pinned images, controlled migration rollout, CI/CD release gates, backup/restore testing, secret-manager integration guidance, and operational runbooks. Phase 14 adds readiness, correlation IDs, structured observability and resilient background work. No production launch is claimed before those phases and the final audit.
