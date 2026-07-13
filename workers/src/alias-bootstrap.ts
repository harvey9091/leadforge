import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(pathToFileURL(import.meta.url).pathname);
const PROJECT_ROOT = join(__dirname, "..");

const originalResolveFilename = require("module")._resolveFilename;

require("module")._resolveFilename = function (request: string, parent: string, ...rest: unknown[]) {
  if (request.startsWith("@/")) {
    const resolved = join(PROJECT_ROOT, "src", request.slice("@".length + 1));
    try {
      return originalResolveFilename.call(this, resolved, parent, ...rest);
    } catch {
      // fall through
    }
  }
  return originalResolveFilename.call(this, request, parent, ...rest);
};

const entrypointPath = join(PROJECT_ROOT, "workers", "src", "entrypoint.ts");

await import(pathToFileURL(entrypointPath).href);
