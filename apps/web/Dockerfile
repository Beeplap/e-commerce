# Multi-stage production Dockerfile for quick-commerce Next.js frontend

# Stage 1: Base image with Node 24 and pnpm
FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

# Enable corepack and pin pnpm version
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps

# Copy repository dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY apps/web/package.json ./apps/web/

# Install frozen dependencies
RUN pnpm install --frozen-lockfile

# Stage 3: Build application
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY apps/web ./apps/web

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Build Next.js with standalone output
RUN pnpm --filter @quick-commerce/web build

# Stage 4: Minimal production runner
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create non-root system user and group (UID 10001)
RUN groupadd -r -g 10001 nodejs && \
    useradd -r -u 10001 -g nodejs nextjs

# Copy standalone build output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Health check probe against Next.js /health
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start Next.js standalone server
CMD ["node", "apps/web/server.js"]
