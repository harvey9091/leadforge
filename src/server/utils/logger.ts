/**
 * Logger — minimal structured logger.
 *
 * Emits single-line JSON to stdout (production) or colorized to console
 * (development). Every log line includes a request/correlation ID when
 * available, so distributed traces can be reconstructed.
 *
 * This is intentionally not a full pino/winston replacement — Phase 2 will
 * swap in pino when the Fastify service is stood up.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

interface LogContext {
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, ctx: LogContext = {}) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const base = {
    level,
    time: new Date().toISOString(),
    msg,
    ...ctx,
  };

  // Guard against Edge Runtime (which doesn't have process.stdout)
  if (typeof process === "undefined" || !process.stdout) {
    try { console.log(JSON.stringify(base)); } catch { /* noop */ }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    process.stdout.write(JSON.stringify(base) + "\n");
  } else {
    const prefix =
      level === "error"
        ? "\x1b[31m✖\x1b[0m"
        : level === "warn"
        ? "\x1b[33m⚠\x1b[0m"
        : level === "info"
        ? "\x1b[34m●\x1b[0m"
        : "\x1b[90m·\x1b[0m";
    const ctxStr = Object.keys(ctx).length
      ? ` \x1b[90m${JSON.stringify(ctx)}\x1b[0m`
      : "";
    process.stdout.write(`${prefix} ${msg}${ctxStr}\n`);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
  child: (defaultCtx: LogContext) => ({
    debug: (msg: string, ctx?: LogContext) => emit("debug", msg, { ...defaultCtx, ...ctx }),
    info: (msg: string, ctx?: LogContext) => emit("info", msg, { ...defaultCtx, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => emit("warn", msg, { ...defaultCtx, ...ctx }),
    error: (msg: string, ctx?: LogContext) => emit("error", msg, { ...defaultCtx, ...ctx }),
  }),
};
