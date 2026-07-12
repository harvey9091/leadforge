"use client";

/**
 * API client — thin wrapper around fetch that handles:
 *  - JSON serialization
 *  - Auth header injection (Bearer from in-memory session)
 *  - Error envelope normalization
 *  - Request ID propagation
 *
 * The client talks to the versioned API root (/api/v1). All endpoints
 * return either { data: T } or { error: { code, message, requestId } }.
 */

import type { ApiError } from "@/types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(opts: {
    code: string;
    message: string;
    status: number;
    requestId?: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "ApiClientError";
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.details = opts.details;
  }
}

const API_ROOT = "/api/v1";

/** In-memory token store — populated by AuthProvider on boot/refresh. */
let _accessToken: string | null = null;
const _tokenListeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  _accessToken = token;
  for (const fn of _tokenListeners) fn(token);
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function onTokenChange(fn: (token: string | null) => void): () => void {
  _tokenListeners.add(fn);
  return () => _tokenListeners.delete(fn);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const url = new URL(
    path.startsWith("http") ? path : `${API_ROOT}${path}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (_accessToken) headers.Authorization = `Bearer ${_accessToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiClientError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Network request failed",
      status: 0,
    });
  }

  const requestId = res.headers.get("X-Request-Id") ?? undefined;

  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiClientError({
      code: body?.error?.code ?? "HTTP_ERROR",
      message: body?.error?.message ?? `Request failed (${res.status})`,
      status: res.status,
      requestId: body?.error?.requestId ?? requestId,
      details: body?.error?.details,
    });
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

export const apiClient = {
  get: <T>(path: string, query?: RequestOptions["query"]) => api<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};
