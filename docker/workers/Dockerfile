# =============================================================================
# Leadforge Worker — Production Dockerfile (Phase 2)
# =============================================================================
#
# Generic Dockerfile for all worker services (discovery, enrichment, ai,
# scheduler, cleanup). The WORKER_TYPE env var selects which worker to run.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g bun
COPY --from=deps /app/node_modules ./node_modules
COPY workers/ ./workers/
COPY packages/ ./packages/
RUN bun run build:workers

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001
USER worker
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/workers/dist ./workers/dist
COPY --from=builder --chown=worker:nodejs /app/package.json ./

ENV NODE_ENV=production
CMD ["node", "workers/dist/index.js"]
