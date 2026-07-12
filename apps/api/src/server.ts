/**
 * =============================================================================
 * Leadforge API — Fastify server entry point (Phase 2)
 * =============================================================================
 *
 * This is the future home of the standalone Fastify REST API. Phase 1
 * uses Next.js API routes (in this repo's /src/app/api/) which work
 * identically but don't require a separate process.
 *
 * Phase 2 migration steps:
 *  1. Implement the routes below with @fastify/swagger auto-generation
 *  2. Move the repository + service layers from /src/server to this app
 *  3. Update the dashboard to call this service instead of Next.js routes
 *  4. Wire Docker Compose to run this service
 * =============================================================================
 */

import Fastify from "fastify";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: {
      target: "@fastify/transport",
      options: { colorize: true },
    },
  },
});

app.get("/api/v1/health", async () => {
  return {
    status: "healthy",
    version: "1.0.0-phase2-stub",
    timestamp: new Date().toISOString(),
  };
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

app
  .listen({ port: PORT, host: HOST })
  .then(() => {
    app.log.info(`Leadforge API listening on http://${HOST}:${PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
