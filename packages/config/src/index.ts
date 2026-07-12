/**
 * @leadforge/config — Shared configuration
 *
 * ESLint, Prettier, TypeScript, and Tailwind presets shared across
 * all apps and packages.
 *
 * Phase 1: each app has its own config. Phase 2 will extract these
 * into the package and consume via "extends".
 */

export const tsConfig = {
  compilerOptions: {
    target: "ES2022",
    lib: ["dom", "dom.iterable", "esnext"],
    module: "esnext",
    moduleResolution: "bundler",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    isolatedModules: true,
    resolveJsonModule: true,
  },
};
