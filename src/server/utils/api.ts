/**
 * API route helpers — typed response envelopes, request ID propagation,
 * and Zod validation.
 *
 * Every successful response is `{ data: T }`.
 * Every error response is `{ error: { code, message, requestId } }`.
 * Every response carries an `X-Request-Id` header for traceability.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { AppError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

export type RequestContext = {
  requestId: string;
  ip?: string;
  userAgent?: string;
};

export function apiSuccess<T>(data: T, init?: ResponseInit & { requestId?: string }) {
  return NextResponse.json(
    { data },
    {
      status: init?.status ?? 200,
      headers: {
        "X-Request-Id": init?.requestId ?? "",
      },
    }
  );
}

export function apiError(
  error: unknown,
  requestId?: string
): NextResponse {
  const id = requestId ?? crypto.randomUUID();
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId: id,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      {
        status: error.status,
        headers: { "X-Request-Id": id },
      }
    );
  }

  // Unexpected error — log full detail, return generic message.
  logger.error("api.unexpectedError", {
    requestId: id,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: id,
      },
    },
    {
      status: 500,
      headers: { "X-Request-Id": id },
    }
  );
}

/** Validate a payload against a Zod schema, throwing ValidationError on failure. */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: first?.message ?? "Validation failed",
      status: 400,
      details: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  return result.data;
}

/** Read the body of a Next.js Request as JSON. */
export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError({
      code: "INVALID_JSON",
      message: "Request body is not valid JSON",
      status: 400,
    });
  }
}

/** Extract request metadata (IP, user agent, request ID) from headers. */
export function getRequestContext(req: Request): RequestContext {
  const headers = req.headers;
  return {
    requestId:
      headers.get("x-request-id") ??
      headers.get("request-id") ??
      crypto.randomUUID(),
    ip:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headers.get("x-real-ip") ??
      undefined,
    userAgent: headers.get("user-agent") ?? undefined,
  };
}
