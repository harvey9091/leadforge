/**
 * GET /api/docs
 * OpenAPI 3.1 spec — generated at request time from the route registry.
 *
 * Phase 1 ships a hand-maintained spec covering the implemented auth and
 * health endpoints. Phase 2 will auto-generate this from Fastify's zod
 * schemas using @fastify/swagger.
 */

import { apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";
export const dynamic = "force-static";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Leadforge API",
    version: "1.0.0-phase1",
    description:
      "Self-hosted lead intelligence platform. REST API for discovering, enriching, qualifying and managing SaaS startup leads.",
    license: { name: "MIT" },
  },
  servers: [
    { url: "/api/v1", description: "Versioned API root" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "lf_session",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Liveness + readiness probe. Returns database and dependent service status.",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service health",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
                    version: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                    services: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Register a new user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Account created; tokens issued" },
          "409": { description: "Email already registered" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Sign in",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated; tokens issued" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Rotate tokens",
        tags: ["Auth"],
        responses: {
          "200": { description: "New token pair issued" },
          "401": { description: "Invalid or expired refresh token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Sign out",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Session revoked" } },
      },
    },
    "/auth/me": {
      get: {
        summary: "Current user",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "User profile" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/companies": {
      get: {
        summary: "List companies",
        tags: ["Companies"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "grade", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated list of companies" } },
      },
    },
    "/people": {
      get: {
        summary: "List people",
        tags: ["People"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Paginated list of people" } },
      },
    },
    "/jobs": {
      get: {
        summary: "List jobs",
        tags: ["Jobs"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Paginated list of jobs" } },
      },
    },
    "/stats/overview": {
      get: {
        summary: "Dashboard KPIs",
        tags: ["Stats"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Aggregated counts and distributions" } },
      },
    },
    "/audit-logs": {
      get: {
        summary: "List audit logs",
        tags: ["Audit"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Paginated audit log" } },
      },
    },
  },
  tags: [
    { name: "System", description: "Health and operational endpoints" },
    { name: "Auth", description: "Authentication and session management" },
    { name: "Companies", description: "Company records" },
    { name: "People", description: "Contact records" },
    { name: "Jobs", description: "Background job queue mirror" },
    { name: "Stats", description: "Aggregated metrics" },
    { name: "Audit", description: "Compliance audit trail" },
  ],
};

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  return apiSuccess(spec, { requestId: ctx.requestId });
}
