# =============================================================================
# Leadforge API — Production Dockerfile (Phase 2)
# =============================================================================
#
# Fastify-based REST API. Phase 1 uses Next.js API routes instead; this
# Dockerfile is included to document the Phase 2 deployment target.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g bun
COPY apps/api/package.json apps/api/bun.lock ./
RUN bun install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g bun
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/ .
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001
USER api
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/dist ./dist
COPY --from=builder --chown=api:nodejs /app/prisma ./prisma
COPY --from=builder --chown=api:nodejs /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/server.js"]
