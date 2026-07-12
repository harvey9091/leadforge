/**
 * Typed error hierarchy.
 *
 * Every error includes a stable `code` string for the client to switch on,
 * and an HTTP `status` so route handlers can throw freely without thinking
 * about response mapping. The global error handler in `/api/_lib/error.ts`
 * does the mapping.
 */

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(params: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
    isOperational?: boolean;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.code = params.code;
    this.status = params.status ?? 500;
    this.details = params.details;
    this.isOperational = params.isOperational ?? true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: "VALIDATION_ERROR", message, status: 400, details });
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super({ code: "AUTH_ERROR", message, status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super({ code: "FORBIDDEN", message, status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super({ code: "NOT_FOUND", message: `${resource} not found`, status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ code: "CONFLICT", message, status: 409 });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super({ code: "RATE_LIMIT_EXCEEDED", message, status: 429 });
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error", details?: unknown) {
    super({ code: "INTERNAL_ERROR", message, status: 500, details, isOperational: false });
  }
}
