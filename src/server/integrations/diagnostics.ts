/**
 * =============================================================================
 * HTTP Diagnostics — classify fetch failures into typed integration errors
 * =============================================================================
 *
 * Distinguishes between:
 *  - timeout (AbortSignal abort / AbortError)
 *  - DNS failure (ENOTFOUND)
 *  - connection refused (ECONNREFUSED)
 *  - TLS failure (certificate errors)
 *  - HTTP auth errors (401, 403)
 *  - HTTP not found (404)
 *  - HTTP server errors (5xx)
 *  - Generic network errors
 * =============================================================================
 */

import {
  NetworkError,
  TimeoutError,
  DnsFailureError,
  ConnectionRefusedError,
  TlsFailureError,
  IntegrationAuthError,
  IntegrationHttpError,
  IntegrationError,
} from "@/server/utils/errors";

export interface DiagnosticResult {
  error: IntegrationError;
  status: number;
  statusText: string;
  latencyMs: number;
  body?: string;
}

const DIAGNOSTIC_CODES: Record<string, { label: string; build: (msg: string, id?: string, cause?: Error) => IntegrationError }> = {
  ETIMEDOUT: { label: "timeout", build: (m, id, c) => new TimeoutError(m, id, c) },
  ECONNREFUSED: { label: "connection_refused", build: (m, id, c) => new ConnectionRefusedError(m, id, c) },
  ENOTFOUND: { label: "dns_failure", build: (m, id, c) => new DnsFailureError(m, id, c) },
  EAI_AGAIN: { label: "dns_failure", build: (m, id, c) => new DnsFailureError(m, id, c) },
  CERT_HAS_EXPIRED: { label: "tls_failure", build: (m, id, c) => new TlsFailureError(m, id, c) },
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: { label: "tls_failure", build: (m, id, c) => new TlsFailureError(m, id, c) },
  DEPTH_ZERO_SELF_SIGNED_CERT: { label: "tls_failure", build: (m, id, c) => new TlsFailureError(m, id, c) },
  SSL_HANDSHAKE_FAILURE: { label: "tls_failure", build: (m, id, c) => new TlsFailureError(m, id, c) },
};

export function classifyNetworkError(error: unknown, integrationId?: string): IntegrationError {
  if (error instanceof IntegrationError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  for (const [code, { build }] of Object.entries(DIAGNOSTIC_CODES)) {
    if (lower.includes(code.toLowerCase())) {
      return build(`Network error (${code}): ${message}`, integrationId, error instanceof Error ? error : undefined);
    }
  }

  if (lower.includes("abort") || lower.includes("aborted") || lower.includes("signal is aborted")) {
    return new TimeoutError(`Request aborted (timeout): ${message}`, integrationId, error instanceof Error ? error : undefined);
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new TimeoutError(`Request timed out: ${message}`, integrationId, error instanceof Error ? error : undefined);
  }

  if (lower.includes("tls") || lower.includes("ssl") || lower.includes("certificate")) {
    return new TlsFailureError(`TLS/SSL error: ${message}`, integrationId, error instanceof Error ? error : undefined);
  }

  if (lower.includes("econnreset") || lower.includes("socket hang up")) {
    return new ConnectionRefusedError(`Connection reset: ${message}`, integrationId, error instanceof Error ? error : undefined);
  }

  return new NetworkError(`Network error: ${message}`, integrationId, error instanceof Error ? error : undefined);
}

export function classifyHttpError(
  status: number,
  statusText: string,
  body?: string,
  integrationId?: string
): IntegrationError {
  if (status === 401) {
    return new IntegrationAuthError(
      `Authentication required (401): ${body?.slice(0, 100) || statusText}`,
      integrationId
    );
  }
  if (status === 403) {
    return new IntegrationAuthError(
      `Access forbidden (403): ${body?.slice(0, 100) || statusText}`,
      integrationId
    );
  }
  if (status === 404) {
    return new IntegrationHttpError(404, "Not Found", body, integrationId);
  }
  if (status >= 500) {
    return new IntegrationHttpError(status, statusText, body, integrationId);
  }
  return new IntegrationHttpError(status, statusText, body, integrationId);
}

export function buildDiagnosticError(
  error: unknown,
  latencyMs: number,
  integrationId?: string,
  status?: number,
  statusText?: string,
  body?: string
): DiagnosticResult {
  if (status && status > 0) {
    const classified = classifyHttpError(status, statusText ?? "Unknown", body, integrationId);
    return {
      error: classified,
      status,
      statusText: statusText ?? "Unknown",
      latencyMs,
      body,
    };
  }

  const classified = classifyNetworkError(error, integrationId);
  return {
    error: classified,
    status: 0,
    statusText: "Network Error",
    latencyMs,
    body: error instanceof Error ? error.message : undefined,
  };
}
