# =============================================================================
# Leadforge Dashboard — Production Dockerfile
# =============================================================================
#
# Multi-stage build for the Next.js dashboard.
# Output: standalone Next.js server on port 3001.
# =============================================================================

# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install bun for faster Prisma generation
RUN npm install -g bun

# Copy lockfile + manifests
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bun run db:generate

# ---- Stage 2: build ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry — disable in CI
ENV NEXT_TELEMETRY_DISABLED=1

# Build the standalone output
RUN bun run build

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

EXPOSE 3001

# Run migrations on boot, then start the server
CMD ["node", "server.js"]
